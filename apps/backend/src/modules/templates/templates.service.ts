import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Domain, Prisma, Role, TemplateStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RunsService } from '../../runs/runs.service';

interface CreateInput {
  userId: string;
  name: string;
  description?: string;
  domain: Domain;
  defaultPrompt: string;
  spec?: Record<string, unknown> | null;
  fromRunId?: string | null;
  isPublic?: boolean;
}

@Injectable()
export class TemplatesService {
  constructor(
    private prisma: PrismaService,
    private runs: RunsService,
  ) {}

  async list(actor: { sub: string; role: Role }, params: {
    domain?: Domain;
    status?: TemplateStatus;
    page?: number;
    perPage?: number;
    publicOnly?: boolean;
  }) {
    const page = params.page ?? 1;
    const perPage = Math.min(params.perPage ?? 20, 100);

    const where: Prisma.TemplateWhereInput = {};
    if (params.domain) where.domain = params.domain;
    if (params.status) where.status = params.status;

    if (params.publicOnly) {
      where.isPublic = true;
    } else {
      where.OR = [{ isPublic: true }, { userId: actor.sub }];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.template.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
        include: {
          user: { select: { id: true, email: true, name: true } },
          forkedFrom: { select: { id: true, name: true } },
        },
      }),
      this.prisma.template.count({ where }),
    ]);
    return { items, total, page, perPage };
  }

  async findById(id: string) {
    const tpl = await this.prisma.template.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        forkedFrom: { select: { id: true, name: true } },
      },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }

  async create(input: CreateInput) {
    let spec = input.spec ?? null;
    let domain = input.domain;
    let forkedFromId: string | undefined;

    if (input.fromRunId) {
      const run = await this.prisma.run.findUnique({
        where: { id: input.fromRunId },
        select: {
          userId: true,
          spec: true,
          domain: true,
          templateId: true,
          status: true,
        },
      });
      if (!run) throw new NotFoundException('Source run not found');
      if (run.userId !== input.userId) {
        throw new ForbiddenException('Cannot derive a template from another user’s run');
      }
      if (run.status !== 'COMPLETED') {
        throw new BadRequestException('Run must be COMPLETED to derive a template');
      }
      spec = (run.spec as Prisma.InputJsonValue as any) ?? null;
      domain = run.domain;
      forkedFromId = run.templateId ?? undefined;
    }

    if (!spec) {
      throw new BadRequestException('Either spec or fromRunId is required');
    }

    return this.prisma.template.create({
      data: {
        userId: input.userId,
        name: input.name,
        description: input.description,
        domain,
        spec: spec as Prisma.InputJsonValue,
        defaultPrompt: input.defaultPrompt,
        isPublic: input.isPublic ?? false,
        forkedFromId,
        status: TemplateStatus.PENDING,
      },
    });
  }

  async update(
    id: string,
    actor: { sub: string; role: Role },
    data: {
      name?: string;
      description?: string;
      domain?: Domain;
      defaultPrompt?: string;
      spec?: Record<string, unknown>;
      isPublic?: boolean;
      status?: TemplateStatus;
    },
  ) {
    const tpl = await this.findById(id);
    const isAdmin = actor.role === Role.ADMIN || actor.role === Role.SUPER_ADMIN;
    if (tpl.userId && tpl.userId !== actor.sub && !isAdmin) {
      throw new ForbiddenException('Cannot modify a template you do not own');
    }
    if (data.status && !isAdmin) {
      throw new ForbiddenException('Only admins can change template status');
    }

    return this.prisma.template.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        domain: data.domain,
        defaultPrompt: data.defaultPrompt,
        spec: data.spec === undefined ? undefined : (data.spec as Prisma.InputJsonValue),
        isPublic: data.isPublic,
        status: data.status,
      },
    });
  }

  async delete(id: string, actor: { sub: string; role: Role }) {
    const tpl = await this.findById(id);
    const isAdmin = actor.role === Role.ADMIN || actor.role === Role.SUPER_ADMIN;
    if (tpl.userId && tpl.userId !== actor.sub && !isAdmin) {
      throw new ForbiddenException('Cannot delete a template you do not own');
    }
    await this.prisma.template.delete({ where: { id } });
    return { message: 'Template deleted' };
  }

  /**
   * Materialize a template into a new Run. Substitutes `{{var}}` placeholders
   * in the prompt before forwarding via RunsService.createRun.
   */
  async instantiate(
    id: string,
    actor: { sub: string; role: Role },
    body: { prompt?: string; variables?: Record<string, string>; sessionId?: string },
  ) {
    const tpl = await this.findById(id);
    if (!tpl.isPublic && tpl.userId && tpl.userId !== actor.sub &&
        actor.role !== Role.ADMIN && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Template is private');
    }

    const promptSource = body.prompt ?? tpl.defaultPrompt;
    const prompt = substitute(promptSource, body.variables ?? {});

    const run = await this.runs.createRun({
      userId: actor.sub,
      prompt,
      domain: tpl.domain,
      sessionId: body.sessionId ?? null,
      templateId: tpl.id,
      attachmentIds: [],
    });

    await this.prisma.template.update({
      where: { id: tpl.id },
      data: { usageCount: { increment: 1 } },
    });

    return {
      runId: run.id,
      streamUrl: `/api/runs/${run.id}/stream`,
      status: run.status,
    };
  }

  approve(id: string) {
    return this.prisma.template.update({
      where: { id },
      data: { status: TemplateStatus.APPROVED },
    });
  }

  reject(id: string) {
    return this.prisma.template.update({
      where: { id },
      data: { status: TemplateStatus.REJECTED },
    });
  }
}

function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{{${key}}}`,
  );
}

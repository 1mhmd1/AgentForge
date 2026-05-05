import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Find by email
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  // Find by Google ID
  async findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({
      where: { googleId },
    });
  }

  // Create user (email/password)
  async createUser(data: {
    email: string;
    name?: string;
    passwordHash?: string;
  }) {
    return this.prisma.user.create({
      data,
    });
  }

  // Create Google user
  async createGoogleUser(data: {
    email: string;
    name: string;
    googleId: string;
  }) {
    return this.prisma.user.create({
      data,
    });
  }
}
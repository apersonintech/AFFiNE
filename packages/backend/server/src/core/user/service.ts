import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { Quota_FreePlanV1_1 } from '../quota/schema';

@Injectable()
export class UserService {
  defaultUserSelect = {
    id: true,
    name: true,
    email: true,
    emailVerifiedAt: true,
    avatarUrl: true,
    registered: true,
  } satisfies Prisma.UserSelect;

  constructor(private readonly prisma: PrismaClient) {}

  get userCreatingData() {
    return {
      name: 'Unnamed',
      features: {
        create: {
          reason: 'created by invite sign up',
          activated: true,
          feature: {
            connect: {
              feature_version: Quota_FreePlanV1_1,
            },
          },
        },
      },
    };
  }

  async createUser(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      select: this.defaultUserSelect,
      data: {
        ...this.userCreatingData,
        ...data,
      },
    });
  }

  async createAnonymousUser(
    email: string,
    data?: Partial<Prisma.UserCreateInput>
  ) {
    const user = await this.findUserByEmail(email);

    if (user) {
      throw new BadRequestException('Email already exists');
    }

    return this.createUser({
      email,
      name: email.split('@')[0],
      ...data,
    });
  }

  async findUserById(id: string) {
    return this.prisma.user
      .findUnique({
        where: { id },
        select: this.defaultUserSelect,
      })
      .catch(() => {
        return null;
      });
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      select: this.defaultUserSelect,
    });
  }

  /**
   * supposed to be used only for `Credential SignIn`
   */
  async findUserWithHashedPasswordByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });
  }

  async findOrCreateUser(
    email: string,
    data?: Partial<Prisma.UserCreateInput>
  ) {
    const user = await this.findUserByEmail(email);
    if (user) {
      return user;
    }
    return this.createAnonymousUser(email, data);
  }

  async fulfillUser(
    email: string,
    data: Partial<
      Pick<Prisma.UserCreateInput, 'emailVerifiedAt' | 'registered'>
    >
  ) {
    const user = await this.findUserByEmail(email);
    if (!user) {
      return this.createUser({
        ...this.userCreatingData,
        email,
        name: email.split('@')[0],
        ...data,
      });
    } else {
      if (user.registered) {
        delete data.registered;
      }
      if (user.emailVerifiedAt) {
        delete data.emailVerifiedAt;
      }

      if (Object.keys(data).length) {
        return await this.prisma.user.update({
          select: this.defaultUserSelect,
          where: { id: user.id },
          data,
        });
      }
    }

    return user;
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}

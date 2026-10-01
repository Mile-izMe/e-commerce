#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/38dd56eaf3e7b65c9094b3cb665d5df3a55d7511da39cdfab30e633cb45347f5/contract';
import endContract from '../../snapshots/38dd56eaf3e7b65c9094b3cb665d5df3a55d7511da39cdfab30e633cb45347f5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ee2d02153331780abb78b0268b8aa589d9d5098cb5686c81c842a9856f527282/contract';
import startContract from '../../snapshots/ee2d02153331780abb78b0268b8aa589d9d5098cb5686c81c842a9856f527282/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'channels',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('guildId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'guild_members',
        columns: [
          col('guildId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('joinedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['userId', 'guildId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'guilds',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ownerId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'messages',
        columns: [
          col('authorId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('channelId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('clientMessageId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'channels',
        constraint: 'channels_guildId_name_key',
        columns: ['guildId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'messages',
        constraint: 'messages_authorId_clientMessageId_key',
        columns: ['authorId', 'clientMessageId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'channels',
        index: 'channels_guildId_idx_b8c02cbb',
        columns: ['guildId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'guild_members',
        index: 'guild_members_guildId_idx_b8c02cbb',
        columns: ['guildId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'guild_members',
        index: 'guild_members_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'guilds',
        index: 'guilds_ownerId_idx_e2d0c1ef',
        columns: ['ownerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'messages',
        index: 'messages_authorId_idx_e47547ed',
        columns: ['authorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'messages',
        index: 'messages_channelId_createdAt_id_idx_bd37c14e',
        columns: ['channelId', 'createdAt', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'messages',
        index: 'messages_channelId_idx_166d3598',
        columns: ['channelId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'channels',
        foreignKey: {
          name: 'channels_guildId_fkey',
          columns: ['guildId'],
          references: { schema: 'public', table: 'guilds', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'guild_members',
        foreignKey: {
          name: 'guild_members_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'guild_members',
        foreignKey: {
          name: 'guild_members_guildId_fkey',
          columns: ['guildId'],
          references: { schema: 'public', table: 'guilds', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'guilds',
        foreignKey: {
          name: 'guilds_ownerId_fkey',
          columns: ['ownerId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'messages',
        foreignKey: {
          name: 'messages_channelId_fkey',
          columns: ['channelId'],
          references: { schema: 'public', table: 'channels', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'messages',
        foreignKey: {
          name: 'messages_authorId_fkey',
          columns: ['authorId'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

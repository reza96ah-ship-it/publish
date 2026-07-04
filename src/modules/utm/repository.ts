import { db } from '@/lib/db'

export class UtmPresetRepository {
  async findAll(workspaceId: string) {
    return db.utmPreset.findMany({
      where: { workspaceId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
  }

  async findById(id: string, workspaceId: string) {
    return db.utmPreset.findFirst({ where: { id, workspaceId } })
  }

  async create(data: {
    workspaceId: string
    name: string
    source: string
    medium: string
    campaign?: string
    term?: string
    content?: string
    platforms?: string[]
    isDefault?: boolean
  }) {
    if (data.isDefault) {
      await db.utmPreset.updateMany({
        where: { workspaceId: data.workspaceId },
        data: { isDefault: false },
      })
    }
    return db.utmPreset.create({ data: {
      workspaceId: data.workspaceId,
      name: data.name,
      source: data.source,
      medium: data.medium,
      campaign: data.campaign ?? '',
      term: data.term ?? '',
      content: data.content ?? '',
      platforms: data.platforms ?? [],
      isDefault: data.isDefault ?? false,
    }})
  }

  async update(id: string, workspaceId: string, data: Partial<{
    name: string
    source: string
    medium: string
    campaign: string
    term: string
    content: string
    platforms: string[]
    isDefault: boolean
  }>) {
    if (data.isDefault) {
      await db.utmPreset.updateMany({
        where: { workspaceId },
        data: { isDefault: false },
      })
    }
    return db.utmPreset.update({ where: { id }, data })
  }

  async delete(id: string, workspaceId: string) {
    return db.utmPreset.deleteMany({ where: { id, workspaceId } })
  }
}

import { UtmPresetRepository } from './repository'

const repo = new UtmPresetRepository()

export class UtmPresetService {
  async list(workspaceId: string) {
    return repo.findAll(workspaceId)
  }

  async create(workspaceId: string, body: {
    name: string
    source: string
    medium: string
    campaign?: string
    term?: string
    content?: string
    platforms?: string[]
    isDefault?: boolean
  }) {
    if (!body.name || !body.source || !body.medium) {
      throw new Error('name, source, and medium are required')
    }
    return repo.create({ workspaceId, ...body })
  }

  async update(id: string, workspaceId: string, body: Partial<{
    name: string
    source: string
    medium: string
    campaign: string
    term: string
    content: string
    platforms: string[]
    isDefault: boolean
  }>) {
    const existing = await repo.findById(id, workspaceId)
    if (!existing) throw new Error('NOT_FOUND')
    return repo.update(id, workspaceId, body)
  }

  async delete(id: string, workspaceId: string) {
    const existing = await repo.findById(id, workspaceId)
    if (!existing) throw new Error('NOT_FOUND')
    return repo.delete(id, workspaceId)
  }
}

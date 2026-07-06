import { CampaignsRepository } from './repository'
import type {
  AuthContext,
  CampaignListQuery,
  CampaignListResult,
  CampaignItem,
  CampaignCreateInput,
} from './types'

export class CampaignsService {
  constructor(private readonly repo: CampaignsRepository = new CampaignsRepository()) {}

  async listCampaigns(auth: AuthContext, query: CampaignListQuery): Promise<CampaignListResult> {
    const rows = await this.repo.list(auth.workspaceId, query)
    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
    return { data: page, nextCursor }
  }

  async createCampaign(auth: AuthContext, input: CampaignCreateInput): Promise<CampaignItem> {
    return this.repo.create(auth.workspaceId, input)
  }
}

export const campaignsService = new CampaignsService()

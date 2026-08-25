export type ShowStatus = 'upcoming' | 'watched'

/** 图片资产：V1 只保留展示图与缩略图，不保留原图。 */
export interface ImageAsset {
  thumbnail?: Blob
  display?: Blob
  contentType: string
  width?: number
  height?: number
}

export interface Show {
  id: string
  title: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  time: string
  cityId: string
  venueId: string
  categoryLevel1Id: string
  categoryLevel2Id: string | null
  status: ShowStatus
  /** true = 草稿，false = 已发布 */
  isDraft: boolean
  poster?: ImageAsset
  languageId?: string
  seat?: string
  cast?: string
  content?: string
  ticketChannelId?: string
  faceValue?: number
  paidPrice?: number
  ticketImage?: ImageAsset
  seatViewImage?: ImageAsset
  rating?: number
  review?: string
  notes?: string
  noteImages?: ImageAsset[]
  createdAt: string
  updatedAt: string
  /** 软删除时间；存在即表示已进入回收站 */
  deletedAt?: string
}

export interface Category {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  /** 默认分类的稳定标识（如 drama.musical）；用户新增的分类没有此字段 */
  defaultKey?: string
  /** 用户是否在管理页改过名（迁移时跳过该分类） */
  userModified?: boolean
  createdAt: string
  updatedAt: string
}

export interface City {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Venue {
  id: string
  name: string
  cityId: string
  createdAt: string
  updatedAt: string
}

export interface Language {
  id: string
  name: string
}

export interface TicketChannel {
  id: string
  name: string
}

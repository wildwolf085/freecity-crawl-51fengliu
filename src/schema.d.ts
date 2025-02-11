declare interface FenhongbaoMeta {
    address: string // 地址
    resource: string // 资源
    age: string // 年龄
    quality: string // 质量
    appearance: string // 外观
    project: string // 项目
    price: string // 价格
    business_time: string // 营业时间
    environment: string // 环境
    security: string // 安全
    comprehensive: string // 综合
}

declare interface FenhongbaoReply {
    _id: number
    uid: number
    star: number
    message: string
    created: number
}

declare interface SchemaFenhongbao {
    _id: number // 粉红豹ID
    // uid: number // 用户ID
    title: string // 粉红豹标题
    contents: string // 粉红豹描述
    // type_id: number // 类型ID
    // areaCode: number // 地区编码
    province: string // 省份
    city: string // 城市
    district: string // 区县
    contact: Record<string, string> // 联系方式
    meta: Partial<FenhongbaoMeta>
    replies: FenhongbaoReply[]
    replyCnt: number
    viewCnt: number
    anonymous: boolean
    email: string
    imgCnt: number
    imgs: string[]
    actived: boolean
    updated: number
    created: number
}
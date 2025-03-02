declare interface FenhongbaoMeta {
    address: string // 地址
    serveLv: string // 服务等级
    serveList: string // 服务列表
    businessTime: string // 营业时间
    consumeLv: string // 消费等级
    consumeAllNight: string // 消费通宵
    girlBeauty: string // 女孩颜值
    girlAge: string // 女孩年龄
    girlNum: string // 女孩数量
    score: string // 评分
    source: string // 来源
    security: string // 安全
    environment: string // 环境
}

declare interface FenhongbaoContact {
    qq: string // QQ
    email: string // 邮箱
    wechat: string // 微信
    phone: string // 电话
    telegram: string // Telegram
    yunxin: string // 与你号
    other: string // 其他
}

declare interface FenhongbaoReply {
    _id: number
    uid: number
    star: number
    message: string
    created: number
}

declare interface SchemaFenhongbao {
    orgId: number // 51风流 ID
    title: string // 粉红豹标题
    contents: string // 粉红豹描述
    hash: string // 粉红豹hash
    cityCode: number // 城市ID
    district: string // 区县
    contactCnt: number // 联系方式数量
    contacts: Partial<FenhongbaoContact> | null // 联系方式
    meta: Partial<FenhongbaoMeta> | null
    replies: FenhongbaoReply[]
    pinned: boolean // 是否置顶
    replyCnt: number
    viewCnt: number
    anonymous: boolean
    imgCnt: number
    imgs: string[]
    cover: string
    vipOnly: boolean
    actived: boolean
    deleted: number
    updated: number
    created: number
}
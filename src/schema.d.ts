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
    _id: number // seq ID
    orgId: number // 51fengliu ID
    title: string // 粉红豹标题
    contents: string // 粉红豹描述
    cityCode: number // 城市ID
    contactCnt: number // 联系方式数量
    contacts: null | Record<string, string> // 联系方式
    meta: Partial<FenhongbaoMeta>
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

declare interface FenhongbaoRaw {
    // id: number
    userId: number
    status: number
    type: number
    title: string
    isRecommend: boolean
    isMerchant: boolean
    isExpired: boolean
    source: number
    score: number
    viewCount: number
    cityCode: number
    girlNum: number
    girlAge: string
    girlBeauty: string
    environment: string
    consumeLv: string
    consumeAllNight: string
    serveList: string
    serveLv: string
    desc: string
    qq: string
    wechat: string
    telegram: string
    yuni: string
    phone: string
    address: string
    picture: string
    coverPicture: string
    anonymous: boolean
    publishedAt: number
    createdAt: number
    isFavorite: boolean
    vipProfileStatus: number
    publisher: string
    userName: string
    userReputation: string
    userStatus: string
    style: string
    vipView: string
    userView: string
    guestView: string
    cover: string
    imgs: string[]
    imgCnt: number
    crawled: number
}

declare interface SchemaFenhongbaoRaw extends FenhongbaoRaw {
    _id: number
}
// created by: freecityadmin at 12/10/2024

import mongodb, { MongoClient } from "mongodb"
const client = new MongoClient('mongodb://127.0.0.1:27017');
export const db = client.db("freecity-241012")


export const DFenhongbao = db.collection<SchemaFenhongbao>('fenhongbao2');	// 粉红豹
export const DFenhongbaoRaw = db.collection<SchemaFenhongbaoRaw>('fenhongbao_51fengliu');	// 粉红豹

const initialize = async () => {
}

const open = async () => {
	try {
		await client.connect()
		await initialize()

	} catch (error) {
		process.exit()
	}
}

const close = async () => {
	try {
		await client.close()
	} catch (error) {
		process.exit()
	}
}

export const getCollection = (name: string) => db.collection(name)


export const getLastIdFromCollection = async (collection: mongodb.Collection<any>, field = "_id") => {
	const v = await collection.find({}, { [field]: 1 }).sort({ [field]: -1 }).limit(1).toArray()
	return v.length === 0 ? 0 : v[0][field] as number || 0
}

export const getFirstIdFromCollection = async (collection: mongodb.Collection<any>, field = "_id") => {
	const v = await collection.find({}, { [field]: 1 }).sort({ [field]: 1 }).limit(1).toArray()
	return v.length === 0 ? 0 : v[0][field] as number || 0
}

export default { open, close }

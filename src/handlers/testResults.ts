import { lambdaWrap } from 'xkore-lambda-helpers/dist/util/lambdaWrap'
import { db } from '../helpers'

export const handler = lambdaWrap({
}, async ({ }) => {
	const testData = await db.query({
		KeyConditionExpression: 'pk = :pk',
		ExpressionAttributeValues: {
			":pk": 'TestEvent'
		}
	})

	return testData
})
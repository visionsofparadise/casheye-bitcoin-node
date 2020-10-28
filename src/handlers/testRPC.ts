import { lambdaWrap } from 'xkore-lambda-helpers/dist/util/lambdaWrap'
import { object, string } from 'yup'
import axios from 'axios'

export const handler = lambdaWrap({
	validationSchema: object({
		body: object({
			command: string().required()
		})
	})
}, async ({ body }) => {
	const response = await axios.post(process.env.LOADBALANCER_URL! + 'rpc', body)

	return response.data
})
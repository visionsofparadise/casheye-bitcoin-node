export const events = ['inboundTx', 'outboundTx', 'anyTx', 'newBlock']
export type Event = typeof events[number]

export interface IWebhook {
	id: string;
	userId: string;
	address?: string;
	currency?: 'BTC' | 'BTC-testnet',
	confirmations?: number;
	event: Event
	url?: string;
	connectionId?: string;
}
import { Message } from 'src/shared/types'
import Base, { ChatCompletionResponse, onResultChange } from './base'
import { ApiError } from './errors'

// import LMStudio from 'LMStudio/browser'

interface Options {
    lmStudioHost: string
    lmStudioModel: string
    temperature: number

}

export default class LMStudio extends Base {
    public name = 'LMStudio'

    public options: Options
    constructor(options: Options) {
        super()
        this.options = options
    }

    getHost(): string {
        let host = this.options.lmStudioHost.trim()
        if (host.endsWith('/')) {
            host = host.slice(0, -1)
        }
        if (!host.startsWith('http')) {
            host = 'http://' + host
        }
        if (host === 'http://localhost:1234') {
            host = 'http://127.0.0.1:1234'
        }
        return host
    }

    async callChatCompletion(rawMessages: Message[], signal?: AbortSignal, onResultChange?: onResultChange): Promise<ChatCompletionResponse> {
        const messages = rawMessages.map(m => ({ role: m.role, content: m.content }))
        const res = await this.post(
            `${this.getHost()}/v1/chat/completions`,
            { 'Content-Type': 'application/json' },
            {
                messages,
                model: this.options.lmStudioModel,
                temperature: this.options.temperature,
                stream: true,
            },
            signal,
        )
        let result: ChatCompletionResponse = {
            content: '',
        }
        await this.handleSSE(res, (message) => {
            if (message === '[DONE]') {
                return
            }
            const data = JSON.parse(message)
            if (data.error) {
                throw new ApiError(`Error from LMSdudio: ${JSON.stringify(data)}`)
            }
            const content = data.choices[0]?.delta?.content
            if (content !== undefined) {
                result.content += content
            }
            const reasoning_content = data.choices[0]?.delta?.reasoning_content
            if (reasoning_content !== undefined) {
                result.reasoning_content = result.reasoning_content || ''
                result.reasoning_content += reasoning_content
            }
            if (onResultChange) {
                onResultChange(result)
            }
        })
        return result
    }

    async listModels(): Promise<string[]> {
        const res = await this.get(`${this.getHost()}/v1/models`, {})
        const json = await res.json()
        if (! json['data']) {
            throw new ApiError(JSON.stringify(json))
        }
        return json['data'].map((m: any) => m['id'])
    }
}

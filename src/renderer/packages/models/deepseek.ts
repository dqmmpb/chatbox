import { Message } from 'src/shared/types'
import { ApiError } from './errors'
import Base, { ChatCompletionResponse, onResultChange } from './base'

interface Options {
    deepseekKey: string
    deepseekHost: string
    deepseekModel: string
    temperature: number
    topP: number
}

export default class Deepseek extends Base {
    public name = 'Deepseek'

    public options: Options
    constructor(options: Options) {
        super()
        this.options = options
        this.options.deepseekHost = this.options.deepseekHost || 'https://api.deepseek.com'
    }

    async callChatCompletion(
        rawMessages: Message[],
        signal?: AbortSignal,
        onResultChange?: onResultChange
    ): Promise<ChatCompletionResponse> {
        const messages = rawMessages.map((m) => ({
            role: m.role,
            content: m.content,
        }))

        const response = await this.post(
            `${this.options.deepseekHost}/chat/completions`,
            this.getHeaders(),
            {
                messages,
                model: this.options.deepseekModel,
                temperature: this.options.temperature,
                top_p: this.options.topP,
                stream: true,
            },
            signal
        )

        let result: ChatCompletionResponse = {
            content: '',
        }
        await this.handleSSE(response, (message) => {
            if (message === '[DONE]') {
                return
            }
            const data = JSON.parse(message)
            if (data.error) {
                throw new ApiError(`Error from Deepseek: ${JSON.stringify(data)}`)
            }
            const content = data.choices[0]?.delta?.content
            const reasoning_content = data.choices[0]?.delta?.reasoning_content
            if (content !== undefined) {
                result.content += content
                if (onResultChange) {
                    onResultChange(result)
                }
            }
            if (reasoning_content !== undefined) {
                result.reasoning_content = result.reasoning_content || ''
                result.reasoning_content += reasoning_content
                if (onResultChange) {
                    onResultChange(result)
                }
            }
        })
        return result
    }

    async listModels(): Promise<string[]> {
        const res = await this.get(`${this.options.deepseekHost}/models`, this.getHeaders())
        const json = await res.json()
        if (!json['data']) {
            throw new ApiError(JSON.stringify(json))
        }
        return json['data'].map((m: any) => m['id'])
    }

    getHeaders() {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.options.deepseekKey}`,
            'Content-Type': 'application/json',
        }
        return headers
    }

    async get(url: string, headers: Record<string, string>) {
        const res = await fetch(url, {
            method: 'GET',
            headers,
        })
        if (!res.ok) {
            const err = await res.text().catch((e) => null)
            throw new ApiError(`Status Code ${res.status}, ${err}`)
        }
        return res
    }
}

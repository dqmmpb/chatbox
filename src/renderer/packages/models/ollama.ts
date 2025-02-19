import { Message } from 'src/shared/types'
import Base, { ChatCompletionResponse, onResultChange } from './base'
import { ApiError } from './errors'
import { log } from 'console'

// import ollama from 'ollama/browser'

interface Options {
    ollamaHost: string
    ollamaModel: string
    temperature: number
}

export default class Ollama extends Base {
    public name = 'Ollama'

    public options: Options
    constructor(options: Options) {
        super()
        this.options = options
    }

    getHost(): string {
        let host = this.options.ollamaHost.trim()
        if (host.endsWith('/')) {
            host = host.slice(0, -1)
        }
        if (!host.startsWith('http')) {
            host = 'http://' + host
        }
        if (host === 'http://localhost:11434') {
            host = 'http://127.0.0.1:11434'
        }
        return host
    }

    async callChatCompletion(rawMessages: Message[], signal?: AbortSignal, onResultChange?: onResultChange): Promise<ChatCompletionResponse> {
        const messages = rawMessages.map(m => ({ role: m.role, content: m.content }))
        const res = await this.post(
            `${this.getHost()}/api/chat`,
            { 'Content-Type': 'application/json' },
            {
                model: this.options.ollamaModel,
                messages,
                stream: true,
                options: {
                    temperature: this.options.temperature,
                }
            },
            signal,
        )
        let result: ChatCompletionResponse = {
            content: '',
        }
        await this.handleNdjson(res, (message) => {
            const data = JSON.parse(message)
            if (data['done']) {
                return
            }
            const content = data['message']?.['content']
            const reasoning_content = data['message']?.['reasoning_content']
            // if (! content) {
            //     throw new ApiError(JSON.stringify(data))
            // }
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
        try {
            const res = await this.get(`${this.getHost()}/api/tags`, {})
            const json = await res.json()
            if (!json['models']) {
                throw new ApiError(JSON.stringify(json))
            }
            return json['models'].map((m: any) => m['name'])
        } catch(e: any) {
            throw new ApiError(e?.message)
        }
    }
}

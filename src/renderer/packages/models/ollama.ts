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
        let hasReasoningContent = false
        await this.handleNdjson(res, (message) => {
            const data = JSON.parse(message)
            if (data['done']) {
                return
            }
            let content = data['message']?.['content']
            // if (! content) {
            //     throw new ApiError(JSON.stringify(data))
            // }
            const thinkPattern = /^<think>(.*?)<\/think>/s
            const matches = content.match(thinkPattern)

            let reasoning_content = undefined
            if (!matches) {
                // 处理未闭合的 think 标签情况
                if (content.startsWith('<think>')) {
                    hasReasoningContent = true
                    reasoning_content = content.slice(7) // '<think>'.length === 7
                    content = undefined
                } else if (hasReasoningContent && !content.endsWith('</think>')) {
                    reasoning_content = content
                    content = undefined
                }
            } else {
                reasoning_content = matches[1].trim()
                if (reasoning_content !== undefined) {
                    hasReasoningContent = true
                    content = content.replace(thinkPattern, '').trim()
                }
            }
            if (content !== undefined) {
                if (content.endsWith('</think>')) {
                    hasReasoningContent = false
                } else {
                    result.content += content
                }
            }
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

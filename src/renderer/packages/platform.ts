import { ElectronIPC } from "src/shared/electron-types"
import { Config, Settings } from "src/shared/types"
import { getOS } from './navigator'
import { parseLocale } from '@/i18n/parser'
import Exporter from './exporter'

export interface PlatformAPI {
    getVersion(): Promise<string>;
    getPlatform(): Promise<string>;
    shouldUseDarkColors(): Promise<boolean>;
    onSystemThemeChange(callback: () => void): () => void;
    onWindowShow(callback: () => void): () => void;
    openLink(url: string): Promise<void>;
    getInstanceName(): Promise<string>;
    getLocale(): Promise<string>;
    ensureShortcutConfig(config: { disableQuickToggleShortcut: boolean }): Promise<void>;
    ensureProxyConfig(config: { proxy?: string }): Promise<void>;
    relaunch(): Promise<void>;
    getConfig(): Promise<Config>;
    getSettings(): Promise<Settings>;
    setStoreValue(key: string, value: any): Promise<void>;
    getStoreValue(key: string): Promise<any>;
    delStoreValue(key: string): void;
    getAllStoreValues(): Promise<{ [key: string]: any }>;
    setAllStoreValues(data: { [key: string]: any }): Promise<void>;
    initTracking(): void;
    trackingEvent(name: string, params: { [key: string]: string }): void;
    shouldShowAboutDialogWhenStartUp(): Promise<boolean>;
    appLog(level: string, message: string): Promise<void>;
}

export class DesktopPlatform implements PlatformAPI {
    public ipc: ElectronIPC
    constructor(ipc: ElectronIPC) {
        this.ipc = ipc
    }

    public exporter = new Exporter()

    public async getVersion() {
        return this.ipc.invoke('getVersion')
    }
    public async getPlatform() {
        return this.ipc.invoke('getPlatform')
    }
    public async shouldUseDarkColors(): Promise<boolean> {
        return await this.ipc.invoke('shouldUseDarkColors')
    }
    public onSystemThemeChange(callback: () => void): () => void {
        return this.ipc.onSystemThemeChange(callback)
    }
    public onWindowShow(callback: () => void): () => void {
        return this.ipc.onWindowShow(callback)
    }
    public async openLink(url: string): Promise<void> {
        return this.ipc.invoke('openLink', url)
    }
    public async getInstanceName(): Promise<string> {
        const hostname = await this.ipc.invoke('getHostname')
        return `${hostname} / ${getOS()}`
    }
    public async getLocale() {
        const locale = await this.ipc.invoke('getLocale')
        return parseLocale(locale)
    }
    public async ensureShortcutConfig(config: { disableQuickToggleShortcut: boolean }): Promise<void> {
        return this.ipc.invoke('ensureShortcutConfig', JSON.stringify(config))
    }
    public async ensureProxyConfig(config: { proxy?: string }): Promise<void> {
        return this.ipc.invoke('ensureProxy', JSON.stringify(config))
    }
    public async relaunch(): Promise<void> {
        return this.ipc.invoke('relaunch')
    }

    public async getConfig(): Promise<Config> {
        return this.ipc.invoke('getConfig')
    }
    public async getSettings(): Promise<Settings> {
        return this.ipc.invoke('getSettings')
    }

    public async setStoreValue(key: string, value: any) {
        const valueJson = JSON.stringify(value)
        return this.ipc.invoke('setStoreValue', key, valueJson)
    }
    public async getStoreValue(key: string) {
        return this.ipc.invoke('getStoreValue', key)
    }
    public delStoreValue(key: string) {
        return this.ipc.invoke('delStoreValue', key)
    }
    public async getAllStoreValues(): Promise<{ [key: string]: any }> {
        const json = await this.ipc.invoke('getAllStoreValues')
        return JSON.parse(json)
    }
    public async setAllStoreValues(data: { [key: string]: any }) {
        await this.ipc.invoke('setAllStoreValues', JSON.stringify(data))
    }

    public initTracking(): void {
        this.trackingEvent('user_engagement', {})
    }
    public trackingEvent(name: string, params: { [key: string]: string }) {
        const dataJson = JSON.stringify({ name, params })
        this.ipc.invoke('analysticTrackingEvent', dataJson)
    }

    public async shouldShowAboutDialogWhenStartUp(): Promise<boolean> {
        return this.ipc.invoke('shouldShowAboutDialogWhenStartUp')
    }

    public async appLog(level: string, message: string) {
        return this.ipc.invoke('appLog', JSON.stringify({ level, message }))
    }
}


export class WebPlatform implements PlatformAPI {

    public exporter = this

    async getVersion(): Promise<string> {
        return "Web Version";
    }

    async getPlatform(): Promise<string> {
        return "Browser";
    }

    async shouldUseDarkColors(): Promise<boolean> {
        // 可以通过检查 CSS 媒体查询来判断是否使用暗色主题
        const darkThemeMQL = window.matchMedia('(prefers-color-scheme: dark)');
        return darkThemeMQL.matches;
    }

    onSystemThemeChange(callback: () => void): () => void {
        const darkThemeMQL = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => callback();
        darkThemeMQL.addEventListener('change', handleChange);
        return () => darkThemeMQL.removeEventListener('change', handleChange);
    }

    onWindowShow(callback: () => void): () => void {
        // 浏览器环境中没有直接对应的概念，可以忽略或提供模拟的回调
        return () => {};
    }

    async openLink(url: string): Promise<void> {
        window.open(url, '_blank');
    }

    async getInstanceName(): Promise<string> {
        return `${window.location.hostname} / ${getOS()}`;
    }

    async getLocale(): Promise<string> {
        return parseLocale(navigator.language);
    }

    async ensureShortcutConfig(config: { disableQuickToggleShortcut: boolean }): Promise<void> {
        // 浏览器环境中无法直接设置快捷键配置，可以记录日志或忽略
        console.log('ensureShortcutConfig is not supported in browser environment.');
    }

    async ensureProxyConfig(config: { proxy?: string }): Promise<void> {
        // 浏览器环境中无法直接设置代理配置，可以记录日志或忽略
        console.log('ensureProxyConfig is not supported in browser environment.');
    }

    async relaunch(): Promise<void> {
        // 浏览器环境中无法重新启动应用，可以记录日志或忽略
        console.log('relaunch is not supported in browser environment.');
    }

    async getConfig(): Promise<Config> {
        // 返回一个默认的配置对象或从 localStorage 中读取
        return JSON.parse(localStorage.getItem('config') || '{}') as Config;
    }

    async getSettings(): Promise<Settings> {
        // 返回一个默认的设置对象或从 localStorage 中读取
        return JSON.parse(localStorage.getItem('settings') || '{}') as Settings;
    }

    async setStoreValue(key: string, value: any): Promise<void> {
        localStorage.setItem(key, JSON.stringify(value));
    }

    async getStoreValue(key: string): Promise<any> {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    }

    delStoreValue(key: string): void {
        localStorage.removeItem(key);
    }

    async getAllStoreValues(): Promise<{ [key: string]: any }> {
        const result: { [key: string]: any } = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                result[key] = JSON.parse(localStorage.getItem(key) || 'null');
            }
        }
        return result;
    }

    async setAllStoreValues(data: { [key: string]: any }): Promise<void> {
        Object.keys(data).forEach(key => {
            localStorage.setItem(key, JSON.stringify(data[key]));
        });
    }

    initTracking(): void {
        // 在浏览器环境中初始化跟踪事件（例如 Google Analytics）
        console.log('Tracking initialized.');
    }

    trackingEvent(name: string, params: { [key: string]: string }): void {
        // 发送跟踪事件（例如 Google Analytics）
        console.log(`Tracking event: ${name}`, params);
    }

    async shouldShowAboutDialogWhenStartUp(): Promise<boolean> {
        // 返回一个默认值或从 localStorage 中读取
        return JSON.parse(localStorage.getItem('showAboutDialogOnStartup') || 'false');
    }

    async appLog(level: string, message: string): Promise<void> {
        console.log(`[${level}] ${message}`);
    }
}

let isElectron = false;

if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
    isElectron = true;
}

let platform: PlatformAPI;

if (isElectron) {
    platform = new DesktopPlatform(window.electronAPI as any);
} else {
    platform = new WebPlatform();
}

export default platform;

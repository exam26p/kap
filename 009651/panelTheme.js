// panelTheme.js - نظام الثيمات المتقدم
import { state } from './state.js';
import * as DB from './db.js';
import { toast } from './utils.js';

const themes = {
    default: {
        name: 'الافتراضي',
        colors: {
            '--bg-deep': '#060a12',
            '--bg-main': '#0b1120',
            '--bg-card': '#111b2e',
            '--bg-card2': '#0e1728',
            '--bg-input': '#090f1c',
            '--border': '#1a2940',
            '--border-light': '#243656',
            '--text-primary': '#f0f4f8',
            '--text-secondary': '#8899b5',
            '--text-muted': '#465a78',
            '--accent': '#f59e0b',
            '--accent-light': '#fbbf24',
            '--green': '#10b981',
            '--blue': '#3b82f6',
            '--red': '#ef4444',
            '--purple': '#8b5cf6'
        }
    },
    dark_blue: {
        name: 'الأزرق الداكن',
        colors: {
            '--bg-deep': '#0a0c15',
            '--bg-main': '#0f1423',
            '--bg-card': '#1a1f35',
            '--bg-card2': '#151a2e',
            '--bg-input': '#0c1020',
            '--border': '#2a3466',
            '--border-light': '#35407a',
            '--text-primary': '#e8edff',
            '--text-secondary': '#8e9cd4',
            '--text-muted': '#5a69a1',
            '--accent': '#3b82f6',
            '--accent-light': '#60a5fa',
            '--green': '#10b981',
            '--blue': '#2563eb',
            '--red': '#ef4444',
            '--purple': '#8b5cf6'
        }
    },
    dark_green: {
        name: 'الأخضر الداكن',
        colors: {
            '--bg-deep': '#06120a',
            '--bg-main': '#0a1f12',
            '--bg-card': '#10351e',
            '--bg-card2': '#0c2a18',
            '--bg-input': '#081a0f',
            '--border': '#1a4a2a',
            '--border-light': '#2a5a3a',
            '--text-primary': '#e8f5e8',
            '--text-secondary': '#8cb89c',
            '--text-muted': '#4a7a5a',
            '--accent': '#10b981',
            '--accent-light': '#34d399',
            '--green': '#059669',
            '--blue': '#3b82f6',
            '--red': '#ef4444',
            '--purple': '#8b5cf6'
        }
    },
    dark_purple: {
        name: 'البنفسجي الداكن',
        colors: {
            '--bg-deep': '#0e0a18',
            '--bg-main': '#160f28',
            '--bg-card': '#251a42',
            '--bg-card2': '#1f1538',
            '--bg-input': '#120c1f',
            '--border': '#3a2a66',
            '--border-light': '#4a3580',
            '--text-primary': '#f0e8ff',
            '--text-secondary': '#b89cd4',
            '--text-muted': '#7a5aa1',
            '--accent': '#8b5cf6',
            '--accent-light': '#a78bfa',
            '--green': '#10b981',
            '--blue': '#3b82f6',
            '--red': '#ef4444',
            '--purple': '#7c3aed'
        }
    },
    warm: {
        name: 'الذهبي الدافئ',
        colors: {
            '--bg-deep': '#1a0f08',
            '--bg-main': '#2a1a10',
            '--bg-card': '#3a2a1a',
            '--bg-card2': '#2f2215',
            '--bg-input': '#1f150d',
            '--border': '#5a4a2a',
            '--border-light': '#6a5a35',
            '--text-primary': '#fff0e0',
            '--text-secondary': '#d4b89c',
            '--text-muted': '#a18a6a',
            '--accent': '#f59e0b',
            '--accent-light': '#fbbf24',
            '--green': '#10b981',
            '--blue': '#3b82f6',
            '--red': '#ef4444',
            '--purple': '#8b5cf6'
        }
    }
};

export function initThemeModule() {
    loadSavedTheme();
    bindThemeEvents();
}

function bindThemeEvents() {
    const themeSlider = document.getElementById('themeSlider');
    if (themeSlider) {
        themeSlider.addEventListener('input', (e) => {
            applyThemeByHue(parseInt(e.target.value));
        });
    }
    
    const themePresets = document.getElementById('themePresets');
    if (themePresets) {
        themePresets.innerHTML = '';
        Object.entries(themes).forEach(([key, theme]) => {
            const preset = document.createElement('div');
            preset.className = 'theme-preset';
            preset.style.background = `linear-gradient(135deg, ${theme.colors['--accent']}, ${theme.colors['--bg-card']})`;
            preset.title = theme.name;
            preset.onclick = () => applyTheme(theme.colors);
            themePresets.appendChild(preset);
        });
    }
}

function applyThemeByHue(hue) {
    const colors = {
        '--bg-deep': `hsl(${hue}, 25%, 6%)`,
        '--bg-main': `hsl(${hue}, 25%, 10%)`,
        '--bg-card': `hsl(${hue}, 30%, 14%)`,
        '--bg-card2': `hsl(${hue}, 28%, 12%)`,
        '--bg-input': `hsl(${hue}, 25%, 8%)`,
        '--border': `hsl(${hue}, 30%, 22%)`,
        '--border-light': `hsl(${hue}, 28%, 28%)`,
        '--text-primary': `hsl(${hue}, 20%, 95%)`,
        '--text-secondary': `hsl(${hue}, 15%, 70%)`,
        '--text-muted': `hsl(${hue}, 20%, 45%)`,
        '--accent': `hsl(${hue}, 85%, 55%)`,
        '--accent-light': `hsl(${hue}, 85%, 65%)`,
        '--green': '#10b981',
        '--blue': '#3b82f6',
        '--red': '#ef4444',
        '--purple': '#8b5cf6'
    };
    applyTheme(colors);
    saveThemeHue(hue);
}

function applyTheme(colors) {
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
        if (value) {
            root.style.setProperty(key, value);
        }
    });
    
    const colorPreview = document.getElementById('themeColorPreview');
    if (colorPreview && colors['--accent']) {
        colorPreview.style.background = colors['--accent'];
    }
}

function saveThemeHue(hue) {
    localStorage.setItem('app_theme_hue', hue);
    DB.updateData('app_settings', { themeHue: hue }).catch(console.error);
}

function loadSavedTheme() {
    const savedHue = localStorage.getItem('app_theme_hue') || state.settings?.themeHue || 35;
    const slider = document.getElementById('themeSlider');
    if (slider) {
        slider.value = savedHue;
        applyThemeByHue(parseInt(savedHue));
    }
}

window.initThemeModule = initThemeModule;
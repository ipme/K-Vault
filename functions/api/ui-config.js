import { checkAuthentication, isAuthRequired } from '../utils/auth.js';
import { apiError, apiSuccess } from '../utils/api-v1.js';

const UI_CONFIG_KEY = 'ui_config';
const EFFECT_STYLES = new Set(['none', 'math', 'particle', 'texture']);

const DEFAULT_UI_CONFIG = {
  version: 1,
  baseColor: '#fafaf8',
  globalBackgroundUrl: '',
  loginBackgroundMode: 'follow-global',
  loginBackgroundUrl: '',
  cardOpacity: 86,
  cardBlur: 14,
  effectStyle: 'math',
  effectIntensity: 22,
  optimizeMobile: true,
};

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeHexColor(value) {
  const text = String(value || '').trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) {
    return DEFAULT_UI_CONFIG.baseColor;
  }
  if (text.length === 4) {
    return (
      '#' +
      text[1] +
      text[1] +
      text[2] +
      text[2] +
      text[3] +
      text[3]
    ).toLowerCase();
  }
  return text.toLowerCase();
}

function sanitizeUrl(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  if (/^(https?:)?\/\//i.test(text)) return text;
  if (/^\//.test(text)) return text;
  return '';
}

function normalizeUiConfig(raw) {
  const next = Object.assign({}, DEFAULT_UI_CONFIG, raw || {});
  next.baseColor = normalizeHexColor(next.baseColor);
  next.globalBackgroundUrl = sanitizeUrl(next.globalBackgroundUrl);
  next.loginBackgroundMode = next.loginBackgroundMode === 'custom' ? 'custom' : 'follow-global';
  next.loginBackgroundUrl = sanitizeUrl(next.loginBackgroundUrl);
  next.cardOpacity = Math.round(clampNumber(next.cardOpacity, 0, 100));
  next.cardBlur = Math.round(clampNumber(next.cardBlur, 0, 32));
  next.effectStyle = EFFECT_STYLES.has(next.effectStyle) ? next.effectStyle : DEFAULT_UI_CONFIG.effectStyle;
  next.effectIntensity = Math.round(clampNumber(next.effectIntensity, 0, 100));
  next.optimizeMobile = next.optimizeMobile !== false;
  return next;
}

function extractUiConfigPayload(body = {}) {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if (body.config && typeof body.config === 'object' && !Array.isArray(body.config)) {
      return body.config;
    }
    if (body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings)) {
      return body.settings;
    }
    return body;
  }
  return {};
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestGet(context) {
  if (!context.env?.img_url) {
    return apiError(
      'SERVER_MISCONFIGURED',
      'KV binding img_url is not configured.',
      500
    );
  }

  let saved = null;
  try {
    saved = await context.env.img_url.get(UI_CONFIG_KEY, { type: 'json' });
  } catch {
    saved = null;
  }

  const config = normalizeUiConfig(saved || DEFAULT_UI_CONFIG);
  return apiSuccess({
    config,
    source: saved ? 'kv' : 'default',
  });
}

export async function onRequestPost(context) {
  if (!context.env?.img_url) {
    return apiError(
      'SERVER_MISCONFIGURED',
      'KV binding img_url is not configured.',
      500
    );
  }

  if (isAuthRequired(context.env)) {
    const auth = await checkAuthentication(context);
    if (!auth.authenticated) {
      return apiError('UNAUTHORIZED', 'You need to login.', 401);
    }
  }

  let body = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const config = normalizeUiConfig(extractUiConfigPayload(body));
  await context.env.img_url.put(UI_CONFIG_KEY, JSON.stringify(config));

  return apiSuccess({
    config,
    source: 'kv',
  });
}

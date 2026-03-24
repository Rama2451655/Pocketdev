// src/utils/fileUtils.ts
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

export function getDirName(filePath: string): string {
  return filePath.substring(0, filePath.lastIndexOf('/'));
}

export function joinPath(...parts: string[]): string {
  return parts
    .map((part, i) => i === 0 ? part.replace(/\/$/, '') : part.replace(/^\/|\/$/g, ''))
    .filter(Boolean)
    .join('/');
}

export function getRelativePath(from: string, to: string): string {
  const fromParts = from.split('/').filter(Boolean);
  const toParts = to.split('/').filter(Boolean);
  let commonLength = 0;
  while (commonLength < fromParts.length && fromParts[commonLength] === toParts[commonLength]) {
    commonLength++;
  }
  const ups = fromParts.length - commonLength;
  const downs = toParts.slice(commonLength);
  return [...Array(ups).fill('..'), ...downs].join('/') || '.';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, exp)).toFixed(1)} ${units[exp]}`;
}

export function isTextFile(fileName: string): boolean {
  const textExtensions = new Set([
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
    'go', 'rs', 'php', 'rb', 'swift', 'kt', 'cs', 'scala',
    'html', 'htm', 'css', 'scss', 'sass', 'less',
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env',
    'md', 'txt', 'log', 'sh', 'bash', 'zsh', 'fish',
    'sql', 'graphql', 'gql', 'r', 'dart', 'lua', 'vim',
    'dockerfile', 'gitignore', 'prettierrc', 'eslintrc', 'babelrc',
  ]);
  const ext = getFileExtension(fileName);
  return textExtensions.has(ext) || ext === '';
}

export function isBinaryFile(fileName: string): boolean {
  return !isTextFile(fileName);
}

export function generateUniqueFileName(baseName: string, existingNames: string[]): string {
  if (!existingNames.includes(baseName)) return baseName;
  const ext = getFileExtension(baseName);
  const nameWithoutExt = ext ? baseName.slice(0, -(ext.length + 1)) : baseName;
  let counter = 1;
  while (true) {
    const candidate = ext ? `${nameWithoutExt} (${counter}).${ext}` : `${nameWithoutExt} (${counter})`;
    if (!existingNames.includes(candidate)) return candidate;
    counter++;
  }
}

export function sortFileNodes(nodes: any[]): any[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export function flattenFileTree(nodes: any[], depth = 0): Array<{ node: any; depth: number }> {
  const result: Array<{ node: any; depth: number }> = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.type === 'directory' && node.isExpanded && node.children) {
      result.push(...flattenFileTree(node.children, depth + 1));
    }
  }
  return result;
}


// ---- CODE UTILITIES ----

export function detectLanguageFromContent(content: string): string {
  const firstLine = content.split('\n')[0].trim();

  if (firstLine.startsWith('#!/usr/bin/env python') || firstLine.startsWith('#!/usr/bin/python')) return 'python';
  if (firstLine.startsWith('#!/bin/bash') || firstLine.startsWith('#!/bin/sh')) return 'shell';
  if (firstLine.startsWith('#!/usr/bin/env node')) return 'javascript';
  if (firstLine.startsWith('<?php')) return 'php';
  if (firstLine.startsWith('<?xml') || firstLine.startsWith('<')) return 'xml';
  if (content.includes('package main') && content.includes('func main()')) return 'go';
  if (content.includes('fn main()') && content.includes('println!')) return 'rust';
  if (content.includes('public class') && content.includes('void main')) return 'java';
  if (content.includes('import React') || content.includes('from "react"')) return 'javascriptreact';
  if (content.startsWith('{') || content.startsWith('[')) {
    try { JSON.parse(content); return 'json'; } catch {}
  }

  return 'plaintext';
}

export function extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({ language: match[1] || 'plaintext', code: match[2].trim() });
  }
  return blocks;
}

export function countLines(code: string): number {
  return code.split('\n').length;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function truncateMiddle(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const half = Math.floor((maxLength - 3) / 2);
  return `${str.slice(0, half)}...${str.slice(-half)}`;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

// Encode/decode for WebView messages
export function encodeForWebView(str: string): string {
  return encodeURIComponent(str);
}

export function decodeFromWebView(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

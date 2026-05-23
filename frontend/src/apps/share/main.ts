import ShareApp from './ShareApp.svelte';
import { mount } from 'svelte';

const target = document.getElementById('app');

if (!target) {
  throw new Error('missing #app mount target');
}

// Clear any template fallback (e.g. loading spinner) before Svelte takes over
target.textContent = '';

mount(ShareApp, { target });
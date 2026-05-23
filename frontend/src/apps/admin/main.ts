import AdminApp from './AdminApp.svelte';
import { mount } from 'svelte';

const target = document.getElementById('app');

if (!target) {
  throw new Error('missing #app mount target');
}

mount(AdminApp, { target });

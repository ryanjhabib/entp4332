// The Mac app waitlist. "Waitlist" (top right of home and loading) opens the
// join screen; Enter in its email band adds the address to the `waitlist`
// table in Supabase. Only the email is sent, nothing about the user's files.
// The table's Row Level Security lets visitors add a row but never read one.

import { $, show } from './dom.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const intro = $('#join-intro');
const email = $('#join-email');
let back = 'start'; // the screen Waitlist was pressed on

function leave() {
  show(back);
}

// For a scan finishing: shows `id`, unless the waitlist is open, which isn't
// left mid-email; its Back then goes to `id` instead of the screen it came from.
export function showAfterWaitlist(id) {
  if ($('#join').hidden) return show(id);
  back = id;
}

// Delegated: loading.js copies the home header, Waitlist included, onto the loading screen.
document.addEventListener('click', async (event) => {
  const button = event.target.closest('.waitlist-open');
  if (!button) return;
  if (button.id === 'join-back') return leave();
  back = button.closest('.screen').id;
  await show('join');
  email.focus();
});

email.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') leave();
});

$('#join-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const address = email.value.trim().toLowerCase();
  if (!email.checkValidity() || !address.includes('.')) {
    intro.textContent = 'That email doesn’t look right.';
    return;
  }
  email.disabled = true;
  try {
    const response = await fetch(`${URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ email: address }),
    });
    // 409: already on the list, which is the same outcome.
    if (!response.ok && response.status !== 409) throw new Error(`waitlist ${response.status}`);
    intro.textContent = 'Thank you, you’re on the list.';
    email.value = '';
    email.placeholder = 'We’ll email you when it’s ready.';
  } catch (error) {
    console.warn(error);
    intro.textContent = 'That didn’t save. Try again.';
    email.disabled = false;
    email.focus();
  }
});

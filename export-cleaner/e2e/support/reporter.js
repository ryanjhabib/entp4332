// Prints a plain-language summary after the usual list of checks: how many
// passed, which failed and where to look, and the known bugs that are
// waiting to be fixed (tests marked test.fixme, with their one-line reason).

const minutes = (ms) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
};

export default class PlainReporter {
  constructor() {
    this.results = [];
  }

  onTestEnd(test, result) {
    this.results.push({ test, result });
  }

  printsToStdio() {
    return true;
  }

  onEnd({ duration }) {
    const name = (test) => test.titlePath().slice(3).join(' › ');
    const final = new Map();
    for (const entry of this.results) final.set(entry.test.id, entry); // the last try counts
    const all = [...final.values()];
    const passed = all.filter(({ result }) => result.status === 'passed');
    const failed = all.filter(({ result }) => ['failed', 'timedOut', 'interrupted'].includes(result.status));
    const known = all.filter(({ test }) => test.annotations.some((a) => a.type === 'fixme'));

    const lines = ['', '─'.repeat(72), ''];
    lines.push(`Export Cleaner: ${passed.length} checks passed, ${failed.length} failed, ` +
      `${known.length} not checked yet (marked fixme). Took ${minutes(duration)}.`);
    if (failed.length) {
      lines.push('', 'FAILED (something the app should do didn’t happen):');
      for (const { test, result } of failed) {
        const why = (result.errors[0]?.message ?? result.status).split('\n')[0].replace(/\u001b\[[0-9;]*m/g, '');
        lines.push(`  ✗ ${name(test)}`, `      ${why}`, `      ${test.location.file.split('/e2e/')[1]}:${test.location.line}`);
      }
      lines.push('', 'Screenshots and recordings of each failure are in e2e/test-results.',
        'To replay one step by step: npx playwright show-trace e2e/test-results/<folder>/trace.zip');
    }
    if (known.length) {
      lines.push('', 'Not checked yet (marked fixme), with the reason:');
      for (const { test } of known) {
        const reason = test.annotations.find((a) => a.type === 'bug')?.description;
        lines.push(`  • ${name(test)}${reason ? `\n      ${reason}` : ''}`);
      }
    }
    lines.push('');
    console.log(lines.join('\n'));
  }
}

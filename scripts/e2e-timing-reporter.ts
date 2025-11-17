// Custom Playwright reporter for timing e2e tests
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

interface TestTiming {
  name: string;
  file: string;
  duration: number;
  status: string;
}

class E2ETimingReporter implements Reporter {
  private testTimings: TestTiming[] = [];
  private totalDuration = 0;

  onBegin(config: FullConfig, suite: Suite) {
    console.log('\n🕐 Starting e2e test timing analysis...\n');
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const timing: TestTiming = {
      name: test.title,
      file: test.location.file.replace(/.*\/tests\/e2e\//, ''),
      duration: result.duration,
      status: result.status,
    };
    this.testTimings.push(timing);
    this.totalDuration += result.duration;
  }

  onEnd(result: FullResult) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    E2E TEST TIMING REPORT');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Sort by duration (slowest first)
    const sortedTimings = [...this.testTimings].sort((a, b) => b.duration - a.duration);

    // Display all tests with timing
    console.log('All Tests (sorted by duration):\n');
    sortedTimings.forEach((timing, index) => {
      const durationSeconds = (timing.duration / 1000).toFixed(2);
      const statusIcon = timing.status === 'passed' ? '✓' : '✗';
      console.log(
        `${(index + 1).toString().padStart(3)}. ${statusIcon} ${durationSeconds.padStart(7)}s - ${timing.name}`
      );
      console.log(`     ${timing.file}\n`);
    });

    // Highlight top 3 slowest tests
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('               🐌 TOP 3 SLOWEST TESTS 🐌');
    console.log('       (Candidates for optimization)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const top3 = sortedTimings.slice(0, 3);
    top3.forEach((timing, index) => {
      const durationSeconds = (timing.duration / 1000).toFixed(2);
      const medal = ['🥇', '🥈', '🥉'][index];
      console.log(`${medal} ${index + 1}. ${durationSeconds}s - ${timing.name}`);
      console.log(`   File: ${timing.file}`);
      console.log(`   Status: ${timing.status}\n`);
    });

    // Display aggregate statistics
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                   AGGREGATE STATISTICS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const totalSeconds = (this.totalDuration / 1000).toFixed(2);
    const avgDuration = (this.totalDuration / this.testTimings.length / 1000).toFixed(2);
    const passedTests = this.testTimings.filter((t) => t.status === 'passed').length;
    const failedTests = this.testTimings.filter((t) => t.status === 'failed').length;

    console.log(`Total Tests:     ${this.testTimings.length}`);
    console.log(`Passed:          ${passedTests}`);
    console.log(`Failed:          ${failedTests}`);
    console.log(`Total Duration:  ${totalSeconds}s`);
    console.log(`Average:         ${avgDuration}s per test`);
    console.log(`Slowest Test:    ${(sortedTimings[0].duration / 1000).toFixed(2)}s`);
    console.log(`Fastest Test:    ${(sortedTimings[sortedTimings.length - 1].duration / 1000).toFixed(2)}s`);

    console.log('\n═══════════════════════════════════════════════════════════════\n');
  }
}

export default E2ETimingReporter;

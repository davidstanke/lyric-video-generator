const assert = require('assert');
const { resolveManifestOverlaps } = require('./lyricAligner');

function runTests() {
  console.log('Running resolveManifestOverlaps unit tests...');

  // Test Case 1: No overlaps, should remain unchanged (but sorted by startTime)
  {
    const input = [
      { id: 1, startTime: 1.0, endTime: 3.0, text: 'Hello' },
      { id: 2, startTime: 4.0, endTime: 6.0, text: 'World' }
    ];
    const output = resolveManifestOverlaps(input);
    assert.strictEqual(output.length, 2);
    assert.strictEqual(output[0].startTime, 1.0);
    assert.strictEqual(output[0].endTime, 3.0);
    assert.strictEqual(output[1].startTime, 4.0);
    assert.strictEqual(output[1].endTime, 6.0);
    console.log('✅ Test Case 1 Passed: No overlaps');
  }

  // Test Case 2: Simple overlap resolution
  {
    const input = [
      { id: 1, startTime: 1.0, endTime: 3.5, text: 'Hello' },
      { id: 2, startTime: 3.0, endTime: 5.0, text: 'World' }
    ];
    const output = resolveManifestOverlaps(input);
    assert.strictEqual(output.length, 2);
    assert.strictEqual(output[0].startTime, 1.0);
    assert.strictEqual(output[0].endTime, 3.0); // clipped
    assert.strictEqual(output[1].startTime, 3.0);
    assert.strictEqual(output[1].endTime, 5.0);
    console.log('✅ Test Case 2 Passed: Simple overlap resolution');
  }

  // Test Case 3: Squeezed duration (startTime pushed back)
  {
    const input = [
      { id: 1, startTime: 2.8, endTime: 4.0, text: 'Hello' },
      { id: 2, startTime: 2.5, endTime: 5.0, text: 'World' }
    ];
    // Sorted order will be:
    // Index 0: startTime 2.5, endTime 5.0
    // Index 1: startTime 2.8, endTime 4.0
    // Overlap: Index 0 ends at 5.0, Index 1 starts at 2.8.
    // Index 0 end clipped to 2.8. Index 0 is [2.5, 2.8]. Valid.
    const output = resolveManifestOverlaps(input);
    assert.strictEqual(output.length, 2);
    assert.strictEqual(output[0].startTime, 2.5);
    assert.strictEqual(output[0].endTime, 2.8);
    assert.strictEqual(output[1].startTime, 2.8);
    assert.strictEqual(output[1].endTime, 4.0);
    console.log('✅ Test Case 3 Passed: Sorting and simple overlap');
  }

  // Test Case 4: Extreme squeeze resulting in backward start-time push
  {
    const input = [
      { id: 1, startTime: 3.0, endTime: 5.0, text: 'A' },
      { id: 2, startTime: 2.95, endTime: 6.0, text: 'B' }
    ];
    // Sorted order:
    // Index 0: [2.95, 6.0] (B)
    // Index 1: [3.0, 5.0] (A)
    // Overlap: Index 0 endTime (6.0) is clipped to Index 1 startTime (3.0).
    // Index 0 becomes [2.95, 3.0]. Duration is 0.05s (< 0.1s).
    // Index 0 startTime is pushed back to 3.0 - 0.1 = 2.9s.
    // Index 0 becomes [2.9, 3.0].
    const output = resolveManifestOverlaps(input);
    assert.strictEqual(output.length, 2);
    assert.strictEqual(output[0].startTime, 2.9);
    assert.strictEqual(output[0].endTime, 3.0);
    assert.strictEqual(output[1].startTime, 3.0);
    assert.strictEqual(output[1].endTime, 5.0);
    console.log('✅ Test Case 4 Passed: Extreme squeeze start-time push');
  }

  // Test Case 5: Propagation backward through multiple segments
  {
    const input = [
      { id: 1, startTime: 2.8, endTime: 3.0, text: 'A' },
      { id: 2, startTime: 2.9, endTime: 3.5, text: 'B' },
      { id: 3, startTime: 2.9, endTime: 4.0, text: 'C' }
    ];
    // Sorted:
    // Index 0: [2.8, 3.0]
    // Index 1: [2.9, 3.5]
    // Index 2: [2.9, 4.0]
    // 
    // Step i=0:
    // Index 0 [2.8, 3.0], Index 1 [2.9, 3.5]
    // Overlap: 3.0 > 2.9. Index 0 end clipped to 2.9. Index 0 [2.8, 2.9]. Valid.
    // 
    // Step i=1:
    // Index 1 [2.9, 3.5], Index 2 [2.9, 4.0]
    // Overlap: 3.5 > 2.9. Index 1 end clipped to 2.9. Index 1 [2.9, 2.9].
    // Squeezed: Index 1 start pushed back to 2.8. Index 1 [2.8, 2.9].
    // Propagate backward:
    // Index 0 [2.8, 2.9] ends after Index 1 starts at 2.8.
    // Index 0 end clipped to 2.8. Index 0 [2.8, 2.8].
    // Squeezed: Index 0 start pushed back to 2.7. Index 0 [2.7, 2.8].
    // 
    // Final expected:
    // Index 0: [2.7, 2.8]
    // Index 1: [2.8, 2.9]
    // Index 2: [2.9, 4.0]
    const output = resolveManifestOverlaps(input);
    assert.strictEqual(output.length, 3);
    assert.strictEqual(output[0].startTime, 2.7);
    assert.strictEqual(output[0].endTime, 2.8);
    assert.strictEqual(output[1].startTime, 2.8);
    assert.strictEqual(output[1].endTime, 2.9);
    assert.strictEqual(output[2].startTime, 2.9);
    assert.strictEqual(output[2].endTime, 4.0);
    console.log('✅ Test Case 5 Passed: Recursive backward propagation');
  }

  console.log('🎉 All resolveManifestOverlaps unit tests passed!');
}

try {
  runTests();
} catch (error) {
  console.error('❌ Unit tests failed:', error);
  process.exit(1);
}

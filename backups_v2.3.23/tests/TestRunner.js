/**
 * tests/TestRunner.js - Lightweight Test Framework
 */

window.TestRunner = {
    tests: [],
    
    describe: function(name, fn) {
        this.currentSuite = name;
        fn();
    },
    
    it: function(name, fn) {
        this.tests.push({
            suite: this.currentSuite,
            name: name,
            fn: fn
        });
    },
    
    expect: function(actual) {
        return {
            toBe: function(expected) {
                if (actual !== expected) {
                    throw new Error(`Expected ${expected} but got ${actual}`);
                }
            },
            toBeCloseTo: function(expected, precision = 2) {
                if (Math.abs(actual - expected) > Math.pow(10, -precision)) {
                    throw new Error(`Expected ${expected} (close to) but got ${actual}`);
                }
            },
            toBeTruthy: function() {
                if (!actual) {
                    throw new Error(`Expected truthy but got ${actual}`);
                }
            }
        };
    },
    
    run: async function() {
        const results = [];
        console.log("🚀 Running Tests...");
        
        for (const test of this.tests) {
            try {
                await test.fn();
                results.push({ ...test, status: 'pass' });
                console.log(`✅ [${test.suite}] ${test.name}`);
            } catch (err) {
                results.push({ ...test, status: 'fail', error: err.message });
                console.error(`❌ [${test.suite}] ${test.name}: ${err.message}`);
            }
        }
        return results;
    }
};

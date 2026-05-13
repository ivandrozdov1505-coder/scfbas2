const fs = require('fs');

const content = fs.readFileSync('index.html', 'utf8');

function extractFunction(name) {
    // Try both "var name = function" and "function name"
    const varRegex = new RegExp('(?:var|const|let)\\s+' + name + '\\s*=\\s*function\\s*\\(.*?\\)\\s*\\{');
    const funcRegex = new RegExp('function\\s+' + name + '\\s*\\(.*?\\)\\s*\\{');

    let match = content.match(varRegex) || content.match(funcRegex);
    if (!match) {
        throw new Error(`Could not find start of function ${name}`);
    }

    const startIdx = match.index;
    const braceStartIdx = content.indexOf('{', startIdx);

    let braceCount = 1;
    let endIdx = -1;
    for (let i = braceStartIdx + 1; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        else if (content[i] === '}') braceCount--;

        if (braceCount === 0) {
            endIdx = i + 1;
            break;
        }
    }

    if (endIdx === -1) {
        throw new Error(`Could not find end of function ${name}`);
    }

    let code = content.substring(startIdx, endIdx);
    // If it was a "var name = function() { ... }" it might need a semicolon if it was there
    if (content[endIdx] === ';') {
        code += ';';
    }
    return code;
}

try {
    const isValidDateStrCode = extractFunction('isValidDateStr');
    const parseISOCode = extractFunction('parseISO');
    const formatAnalyticsDateCode = extractFunction('formatAnalyticsDate');

    // Evaluate code
    eval(isValidDateStrCode);
    eval(parseISOCode);
    eval(formatAnalyticsDateCode);

    const tests = [
        { input: '2023-10-27', expected: '27.10.2023' },
        { input: '2023-01-01', expected: '01.01.2023' },
        { input: '2023-12-31', expected: '31.12.2023' },
        { input: '2024-02-29', expected: '29.02.2024' }, // Leap year
        { input: 'invalid', expected: '' },
        { input: '', expected: '' },
        { input: null, expected: '' },
        { input: undefined, expected: '' },
        { input: '2023-02-30', expected: '02.03.2023' }, // JS Date behavior for overflow
    ];

    let failed = 0;
    tests.forEach(({ input, expected }) => {
        const result = formatAnalyticsDate(input);
        if (result !== expected) {
            console.error(`FAIL: input="${input}", expected="${expected}", got="${result}"`);
            failed++;
        } else {
            console.log(`PASS: input="${input}", result="${result}"`);
        }
    });

    if (failed > 0) {
        console.error(`\n${failed} tests failed.`);
        process.exit(1);
    } else {
        console.log('\nAll tests passed!');
        process.exit(0);
    }
} catch (e) {
    console.error('Error during test execution:', e);
    process.exit(1);
}

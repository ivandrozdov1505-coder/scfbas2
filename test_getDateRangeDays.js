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
    const getDateRangeDaysCode = extractFunction('getDateRangeDays');

    // Evaluate code
    eval(isValidDateStrCode);
    eval(parseISOCode);
    eval(getDateRangeDaysCode);

    const tests = [
        // Happy path
        { from: '2023-10-27', to: '2023-10-27', expected: 1, desc: 'Same day' },
        { from: '2023-10-27', to: '2023-10-28', expected: 2, desc: 'Next day' },
        { from: '2023-10-27', to: '2023-11-27', expected: 32, desc: 'One month' },
        { from: '2023-01-01', to: '2023-12-31', expected: 365, desc: 'Full non-leap year' },
        { from: '2024-01-01', to: '2024-12-31', expected: 366, desc: 'Full leap year' },

        // Boundaries
        { from: '2023-12-31', to: '2024-01-01', expected: 2, desc: 'Year boundary' },
        { from: '2024-02-28', to: '2024-03-01', expected: 3, desc: 'Leap year Feb boundary' },
        { from: '2023-02-28', to: '2023-03-01', expected: 2, desc: 'Non-leap year Feb boundary' },

        // Edge cases and errors
        { from: '2023-10-27', to: '2023-10-26', expected: 0, desc: 'Negative range' }, // Math.round(-1/86400000)+1 = 0
        { from: 'invalid', to: '2023-10-27', expected: 0, desc: 'Invalid from date' },
        { from: '2023-10-27', to: 'invalid', expected: 0, desc: 'Invalid to date' },
        { from: '', to: '2023-10-27', expected: 0, desc: 'Empty from date' },
        { from: '2023-10-27', to: '', expected: 0, desc: 'Empty to date' },
        { from: null, to: '2023-10-27', expected: 0, desc: 'Null from date' },
        { from: undefined, to: '2023-10-27', expected: 0, desc: 'Undefined from date' },
        { from: '2023-10-27', to: null, expected: 0, desc: 'Null to date' },
    ];

    let failed = 0;
    tests.forEach(({ from, to, expected, desc }) => {
        const result = getDateRangeDays(from, to);
        if (result !== expected) {
            console.error(`FAIL [${desc}]: from="${from}", to="${to}", expected=${expected}, got=${result}`);
            failed++;
        } else {
            console.log(`PASS [${desc}]: from="${from}", to="${to}", result=${result}`);
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

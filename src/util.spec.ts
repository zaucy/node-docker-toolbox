import * as assert from 'assert';
import {optionsToArgs} from './util';
import test from 'ava';

test('arrays to comma separated strings', t => {
  const args = optionsToArgs({
    testOption: ['hello', 'world', 'how', 'are', 'you']
  });

  t.deepEqual(args, ['--test-option', 'hello,world,how,are,you']);
});

test('false does not add arg', t => {
  const args = optionsToArgs({
    testOption: false
  });

  t.deepEqual(args, []);
});

test('true adds arg', t => {
  const args = optionsToArgs({
    testOption: true
  });

  t.deepEqual(args, ['--test-option']);
});

test('numbers are converted to strings', t => {
  const args = optionsToArgs({
    testOption: 42
  });

  t.deepEqual(args, ['--test-option', '42']);
});

test('strings with spaces are wrapped in quotes', t => {
  const args = optionsToArgs({
    testOption: "string with spaces"
  });

  t.deepEqual(args, ['--test-option', `"string with spaces"`]);
});

test('strings without spaces are not wrapped in quotes', t => {
  const args = optionsToArgs({
    testOption: 'stringwithnowhitespacecharacters'
  });

  t.deepEqual(args, ['--test-option', 'stringwithnowhitespacecharacters']);
});

test('objects repeat arg with key=value set as value', t => {
  const args = optionsToArgs({
    buildArg: {
      KEY: 'VALUE',
      something: 'else',
      answer_to_life: 42,
      multipleValues: ['a','b','c'],
      enableThing: true,
      enableOtherThing: false
    }
  });

  t.deepEqual(args, [
    '--build-arg',
    'KEY=VALUE',
    '--build-arg',
    'something=else',
    '--build-arg',
    'answer_to_life=42',
    '--build-arg',
    'multipleValues=a,b,c',
    '--build-arg',
    'enableThing=true',
    '--build-arg',
    'enableOtherThing=false'
  ]);
});

test('throws with whitespace in object key or value', t => {

  t.throws(() => {
    const args = optionsToArgs({
      whatArg: {
        KEY: 'VALUE VALUE VALUE',
      }
    });
  });

  t.throws(() => {
    const args = optionsToArgs({
      whatArg: {
        'KEY KEY KEY': 'VALUE',
      }
    });
  });

  t.throws(() => {
    const args = optionsToArgs({
      whatArg: {
        'KEY KEY KEY': 'VALUE VALUE VALUE',
      }
    });
  });

});

test('prefixes arguments', t => {
  const args = optionsToArgs({
    testNumber: 10,
    testString: 'hello',
    testArray: ['a', 'b', 'c'],
    testBool: true,
    testObject: {
      KEY: 'VALUE'
    }
  }, {prefix: 'test-prefix-'});

  t.deepEqual(args, [
    '--test-prefix-test-number', '10',
    '--test-prefix-test-string', 'hello',
    '--test-prefix-test-array', 'a,b,c',
    '--test-prefix-test-bool',
    '--test-prefix-test-object', 'KEY=VALUE'
  ]);
});

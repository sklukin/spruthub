const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const code = fs.readFileSync(require.resolve('../logic/statisticsSensors.js'), 'utf8');

function setup(count) {
    const timers = [];
    const requests = [];
    const errors = [];
    let reads = 0;
    let scans = 0;
    const types = new Proxy({}, { get: (_, key) => key });
    const room = { getName: () => 'Kitchen' };
    const accessory = { getRoom: () => room, getName: () => 'Sensor' };
    const service = {
        getAccessory: () => accessory,
        getType: () => 'TemperatureSensor',
        getName: () => 'Temperature'
    };
    const chr = {
        getService: () => service,
        getType: () => { reads++; return 'CurrentTemperature'; },
        getValue: () => 22
    };
    service.getCharacteristics = () => Array(count).fill(chr);
    accessory.getServices = () => [service];
    function request() {
        const req = {};
        ['header', 'path', 'queryString', 'body', 'timeout'].forEach(key => {
            req[key] = () => req;
        });
        req.body = body => { req.bodyContent = body; return req; };
        req.send = () => { requests.push(req); return { getStatus: () => 200 }; };
        return req;
    }
    const context = vm.createContext({
        HS: types, HC: types, global: {},
        log: { info() {}, warn() {}, error: msg => errors.push(msg) },
        Hub: { getAccessories: () => { scans++; return [accessory]; } },
        HttpClient: { GET: request, POST: request },
        Cron: { schedule: () => ({}) },
        setInterval: () => ({}),
        setTimeout: handler => { const task = { handler }; timers.push(task); return task; },
        clear: task => { task.cancelled = true; }
    });
    vm.runInContext(code, context);
    function tick() {
        const task = timers.shift();
        if (task && !task.cancelled) task.handler();
    }
    function drain() {
        let limit = 1000;
        while (timers.length && limit-- > 0) tick();
        assert.ok(limit > 0, 'scan must finish');
    }
    return { context, chr, timers, requests, errors, tick, drain,
        reads: () => reads, scans: () => scans };
}

test('loading and first trigger do not scan devices or access the network', () => {
    const env = setup(500);
    assert.equal(env.requests.length, 0, 'loading must not check databases');
    env.context.trigger(env.chr, 0, {}, {});
    assert.equal(env.scans(), 0, 'trigger must not enumerate devices');
    assert.equal(env.context._cronVariables.batch.length, 1);
    assert.match(env.context._cronVariables.batch[0], /value=0 /);
});

test('refresh yields between chunks and publishes only a complete list', () => {
    const env = setup(500);
    env.context.refreshCharsList({});
    assert.equal(env.reads(), 0, 'refresh must schedule work');
    env.tick();
    assert.ok(env.reads() < 500, 'one callback must not process all characteristics');
    assert.equal(env.context._cronVariables.charsList, null);
    env.context.refreshCharsList({});
    env.drain();
    assert.equal(env.scans(), 1, 'overlapping refresh must be coalesced');
    assert.equal(env.context._cronVariables.charsList.length, 500);
    assert.equal(env.reads(), 500);
});

test('first hourly snapshot waits for collection; triggers still buffer events', () => {
    const env = setup(500);
    env.context.trigger(env.chr, 22, {}, {});
    env.context.sendAllMetrics({});
    assert.equal(env.requests.length, 0);
    env.context.trigger(env.chr, 23, {}, {});
    assert.equal(env.context._cronVariables.batch.length, 2);
    env.drain();
    assert.equal(env.requests.length, 2, 'complete snapshot goes to both databases');
    assert.equal(env.requests[0].bodyContent.split('\n').length, 500);
    assert.equal(env.requests[1].bodyContent, env.requests[0].bodyContent);
});

test('empty list is cached without repeatedly scanning the hub', () => {
    const env = setup(0);
    env.context.sendAllMetrics({});
    env.drain();
    env.context.sendAllMetrics({});
    env.drain();
    assert.equal(env.scans(), 1);
    assert.equal(env.requests.length, 0);
});

test('clearing tasks cancels an in-progress scan', () => {
    const env = setup(500);
    env.context.refreshCharsList({});
    env.tick();
    env.context.clearAllTasks();
    env.drain();
    assert.equal(env.context._cronVariables.charsList, null);
});

test('failed refresh retains the previous list and permits retry', () => {
    const env = setup(1);
    env.context.refreshCharsList({});
    env.drain();
    const previous = env.context._cronVariables.charsList;
    const original = env.context.Hub.getAccessories;
    env.context.Hub.getAccessories = () => { throw new Error('hub unavailable'); };
    env.context.refreshCharsList({});
    env.drain();
    assert.equal(env.context._cronVariables.charsList, previous);
    assert.equal(env.errors.length, 1);
    env.context.Hub.getAccessories = original;
    env.context.refreshCharsList({});
    env.drain();
    assert.notEqual(env.context._cronVariables.charsList, previous);
});


test('scan visits multiple services and devices, excluding rooms and unrelated characteristics', () => {
    const env = setup(0);
    const ignored = { getType: () => 'On' };
    function device(room, groups) {
        return {
            getRoom: () => ({ getName: () => room }),
            getServices: () => groups.map(chars => ({ getCharacteristics: () => chars }))
        };
    }
    env.context.Hub.getAccessories = () => [
        device('Kitchen', [[], [env.chr, ignored], [env.chr]]),
        device('Дом', [[env.chr]]),
        device('Bedroom', [[ignored], [env.chr]])
    ];
    env.context.refreshCharsList({});
    env.drain();
    assert.equal(env.context._cronVariables.charsList.length, 3);
});

test('time budget yields even before the step limit is reached', () => {
    const env = setup(500);
    let now = 0;
    env.context.Date = { now: () => now };
    const getType = env.chr.getType;
    env.chr.getType = () => { now += 25; return getType(); };
    env.context.refreshCharsList({});
    env.tick();
    assert.equal(env.reads(), 1);
    assert.equal(env.context._cronVariables.charsList, null);
    env.drain();
    assert.equal(env.context._cronVariables.charsList.length, 500);
});

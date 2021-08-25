# cheap-di-react
Integration of cheap-di into React via React.context

## How to use

There is simple logger.
`logger.ts`
```ts
export abstract class Logger {
  abstract debug(message: string): void;
}

export class ConsoleLogger extends Logger {
  constructor(private prefix: string) {
    super();
  }

  debug(message: string) {
    console.log(`${this.prefix}: ${message}`);
  }
}

export class AnotherConsoleLogger extends Logger {
  debug(message: string) {
    console.log(message);
  }
}
```

Use it in react

`components.tsx`
```tsx
import {
  Provider,
  OneTimeProvider,
  SelfProvider,
  SelfOneTimeProvider,
} from 'cheap-di-react';
import { Logger, ConsoleLogger } from './logger';

const RootComponent = () => {
  return (
    <>
      <Provider
        // will update dependencies on each render
        dependencies={[
          dr => dr.registerType(ConsoleLogger).as(Logger).with('my message'),
        ]}
      >
        <ComponentA/>
      </Provider>

      <OneTimeProvider
        // will use initial dependecies (it uses useMemo under hood)
        dependencies={[
          dr => dr.registerType(ConsoleLogger).as(Logger).with('my message'),
        ]}
      >
        <ComponentA/>
      </OneTimeProvider>

      {/* shortcut for <Provider dependencies={[ dr => dr.registerType(ConsoleLogger) ]}> ... </Provider> */}
      <SelfProvider
        // will update dependencies on each render
        dependencies={[AnotherConsoleLogger]}
      >
        <ComponentB/>
      </SelfProvider>

      <SelfOneTimeProvider
        // will use initial dependecies (it uses useMemo under hood)
        dependencies={[AnotherConsoleLogger]}
      >
        <ComponentB/>
      </SelfOneTimeProvider>
    </>
  );
};

const ComponentA = () => {
  const logger = use(Logger);
  logger.debug('bla-bla-bla');

  return 'my layout';
};

const ComponentB = () => {
  const logger = use(AnotherConsoleLogger); // because we registered it as self
  logger.debug('bla-bla-bla');

  return 'my layout';
};
```

If you mark your service as `@stateful` (or `@singleton`), Provider will create instance of the service and configures
it fields (with Object.defineProperties), those fields changes (<b>reassign</b>) will trigger `Provider` rerender throw 
`React.Context`, and service consumers will receive field update.

Difference between `@singleton` and `@stateful` that for `@singleton` there will be created only one instance for entire 
Provider tree, and for `@stateful` there will be created different instance per each Provider that register this type.

```tsx
import { SelfOneTimeProvider, use } from 'cheap-di-react';
import { singleton, stateful } from 'cheap-di';

@singleton
class MySingleton {
  data: string[] = ['initial'];

  async loadData() {
    this.data = await Promise.resolve(['some']);
  }
}

@stateful
class MyStateful {
  data: string[] = ['initial'];

  async loadData() {
    this.data = await Promise.resolve(['some']);
  }
}

const RootComponent = () => {
  return (
    <SelfOneTimeProvider dependencies={[MySingleton]}>
      <Component/>
    </SelfOneTimeProvider>
  );
};

const Component = () => {
  const mySingleton = use(MySingleton);

  useEffect(() => {
    (async () => {
      await mySingleton.loadData();
    })();
  }, []);

  return (
    <div>
      {mySingleton.data.map(text => (
        <span key={text} style={{ color: 'blue' }}>
        {text}
      </span>
      ))}
    </div>
  );
};
```

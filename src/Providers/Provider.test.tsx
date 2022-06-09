import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DependencyRegistrator, singleton } from 'cheap-di';
import { stateful } from '../decorators';
import { Provider } from './Provider';
import { SelfOneTimeProvider } from './SelfOneTimeProvider';
import { use } from '../hooks';

test('use jsdom in this test file', () => {
  const element = document.createElement('div');
  expect(element).not.toBeNull();
});

describe('base cases', () => {
  abstract class Logger {
    abstract debug(message: string): string;
  }

  class SomeConsoleLogger extends Logger {
    debug(message: string) {
      return message;
    }
  }

  class ConsoleLogger extends Logger {
    constructor(private prefix: string) {
      super();
    }

    debug(message: string) {
      if (this.prefix) {
        return `${this.prefix}: ${message}`;
      }

      return message;
    }
  }

  test('register type', () => {
    const Component = () => {
      const logger = use(SomeConsoleLogger);
      return <p>{logger.debug('another layout')}</p>;
    };

    const RootComponent = () => (
      <Provider
        dependencies={[
          dr => dr.registerType(SomeConsoleLogger),
        ]}
      >
        <Component/>
      </Provider>
    );

    const { queryByText } = render(<RootComponent/>);
    expect(queryByText('another layout')).toBeInTheDocument();
  });

  test('register type as base type', () => {
    const Component = () => {
      const logger = use(Logger);
      return <p>{logger.debug('my layout')}</p>;
    };

    const RootComponent = () => (
      <Provider
        dependencies={[
          dr => dr.registerType(ConsoleLogger).as(Logger),
        ]}
      >
        <Component/>
      </Provider>
    );

    const { queryByText } = render(<RootComponent/>);
    expect(queryByText('my layout')).toBeInTheDocument();
  });

  test('register type as base type with injection params', () => {
    const Component = () => {
      const logger = use(Logger);
      return <p>{logger.debug('my layout')}</p>;
    };

    const RootComponent = () => (
      <Provider
        dependencies={[
          dr => dr.registerType(ConsoleLogger).as(Logger).with('my message'),
        ]}
      >
        <Component/>
      </Provider>
    );

    const { queryByText } = render(<RootComponent/>);
    expect(queryByText('my message: my layout')).toBeInTheDocument();
  });

  test('register instance', () => {
    class Database {
      readonly entities: string[];

      constructor(entities: string[]) {
        this.entities = entities;
      }
    }

    const entities = ['entity 1', 'entity 2'];

    const Component = () => {
      const database = use(Database);
      return (
        <p>
          {database.entities.map(e => (
            <span key={e}>{e}</span>
          ))}
        </p>
      );
    };

    const RootComponent = () => (
      <Provider
        dependencies={[
          dr => dr.registerInstance(new Database(entities)),
        ]}
      >
        <Component/>
      </Provider>
    );

    const { queryByText } = render(<RootComponent/>);
    expect(queryByText(entities[0])).toBeInTheDocument();
    expect(queryByText(entities[1])).toBeInTheDocument();
  });

  test('nested providers', () => {
    const Component = () => {
      const logger = use(Logger);
      return <p>{logger.debug('my layout')}</p>;
    };

    const RootComponent = () => (
      <Provider
        dependencies={[
          dr => dr.registerType(ConsoleLogger).as(Logger).with('my message'),
        ]}
      >
        <Component/>

        <Provider
          dependencies={[
            dr => dr.registerType(SomeConsoleLogger).as(Logger),
          ]}
        >
          <Component/>
        </Provider>
      </Provider>
    );

    const { queryByText } = render(<RootComponent/>);
    expect(queryByText('my message: my layout')).toBeInTheDocument();
    expect(queryByText('my layout')).toBeInTheDocument();
  });
});

describe('singleton and stateful', () => {
  test('singleton', async () => {
    @singleton
    class MySingleton {
      data: string = 'initial';

      async loadData() {
        this.data = await Promise.resolve('loaded data');
      }
    }

    const dependencies: ((dr: DependencyRegistrator) => void)[] = [
      dr => dr.registerType(MySingleton),
    ];

    const RootComponent = () => {
      return (
        <Provider dependencies={dependencies}>
          <LoadComponent/>

          <Provider dependencies={dependencies}>
            <ReadComponent/>
          </Provider>
        </Provider>
      );
    };

    const buttonId = 'my-button';

    const LoadComponent = () => {
      const mySingleton = use(MySingleton);

      return (
        <div>
          <button
            data-testid={buttonId}
            onClick={() => {
              mySingleton.loadData();
            }}
          />

          <span>
            {mySingleton.data}
          </span>
        </div>
      );
    };

    const ReadComponent = () => (
      <span>
        {use(MySingleton).data}
      </span>
    );

    const { queryAllByText, getByTestId, rerender } = render(<RootComponent/>);

    expect(queryAllByText('initial').length).toBe(2);
    expect(queryAllByText('loaded data').length).toBe(0);

    await act(async () => {
      fireEvent.click(getByTestId(buttonId));
    });

    rerender(<RootComponent/>);

    expect(queryAllByText('initial').length).toBe(0);
    expect(queryAllByText('loaded data').length).toBe(2);
  });

  test('stateful', async () => {
    @stateful
    class MyStateful {
      message: string = 'initial';
    }

    const dependencies: ((dr: DependencyRegistrator) => void)[] = [
      dr => dr.registerType(MyStateful),
    ];

    const firstMessage = 'level 1';
    const secondMessage = 'level 2';

    const button1 = 'my-button-1';
    const button2 = 'my-button-2';

    const RootComponent = () => {
      return (
        <Provider dependencies={dependencies}>
          <LoadComponent message={firstMessage} buttonId={button1}/>
          <ReadComponent/>

          <Provider dependencies={dependencies}>
            <LoadComponent message={secondMessage} buttonId={button2}/>
            <ReadComponent/>
          </Provider>
        </Provider>
      );
    };

    const LoadComponent = ({ message, buttonId }: { message: string, buttonId: string }) => {
      const myStateful = use(MyStateful);

      return (
        <div>
          <button
            data-testid={buttonId}
            onClick={() => {
              myStateful.message = message;
            }}
          />
        </div>
      );
    };

    const ReadComponent = () => {
      const myStateful = use(MyStateful);

      return (
        <span>
          {myStateful.message}
        </span>
      );
    };

    const { queryAllByText, getByTestId, rerender } = render(<RootComponent/>);

    expect(queryAllByText('initial').length).toBe(2);
    expect(queryAllByText(firstMessage).length).toBe(0);
    expect(queryAllByText(secondMessage).length).toBe(0);

    // first state

    await act(async () => {
      fireEvent.click(getByTestId(button1));
    });

    rerender(<RootComponent/>);

    expect(queryAllByText('initial').length).toBe(1);
    expect(queryAllByText(firstMessage).length).toBe(1);
    expect(queryAllByText(secondMessage).length).toBe(0);

    // second state

    await act(async () => {
      fireEvent.click(getByTestId(button2));
    });

    rerender(<RootComponent/>);

    expect(queryAllByText('initial').length).toBe(0);
    expect(queryAllByText(firstMessage).length).toBe(1);
    expect(queryAllByText(secondMessage).length).toBe(1);
  });

  test('nested singletons', async () => {
    @singleton
    class Service1 {
      state: string = '123';
    }

    @singleton
    class Service2 {
      state: string = '456';
    }

    @singleton
    class Service3 {
      state: string = '789';
    }

    const buttonId = 'my-button-3';

    const TestComponent = () => {
      const s1 = use(Service1);
      const s2 = use(Service2);
      const s3 = use(Service3);

      return (
        <>
          <button
            data-testid={buttonId}
            onClick={() => {
              s3.state = '000';
            }}
          >
            update s3 state
          </button>
          <p>{s1.state}</p>
          <p>{s2.state}</p>
          <p>{s3.state}</p>
        </>
      );
    };

    const Component = () => (
      <SelfOneTimeProvider dependencies={[Service1]}>
        <SelfOneTimeProvider dependencies={[Service2]}>
          <SelfOneTimeProvider dependencies={[Service3]}>
            <TestComponent/>
          </SelfOneTimeProvider>
        </SelfOneTimeProvider>
      </SelfOneTimeProvider>
    );

    const { rerender, getByTestId, queryByText } = render(<Component/>);

    expect(queryByText('123')).toBeInTheDocument();
    expect(queryByText('456')).toBeInTheDocument();
    expect(queryByText('789')).toBeInTheDocument();
    expect(queryByText('000')).toBeNull();

    await act(async () => {
      fireEvent.click(getByTestId(buttonId));
    });
    rerender(<Component/>);

    expect(queryByText('123')).toBeInTheDocument();
    expect(queryByText('456')).toBeInTheDocument();
    expect(queryByText('789')).toBeNull();
    expect(queryByText('000')).toBeInTheDocument();
  });
});



import { memo, ReactElement, cloneElement, ComponentProps } from "react";
import { renderHook, render } from "@testing-library/react";
import * as TestRenderer from "react-test-renderer";
import { it, expect, describe } from "vitest";
import {
  Router,
  DefaultParams,
  useRouter,
  Parser,
  BaseLocationHook,
} from "wouter";

it("creates a router object on demand", () => {
  const { result } = renderHook(() => useRouter());
  expect(result.current).toBeInstanceOf(Object);
});

it("creates a router object only once", () => {
  const { result, rerender } = renderHook(() => useRouter());
  const router = result.current;

  rerender();
  expect(result.current).toBe(router);
});

it("does not create new router when <Router /> rerenders", () => {
  const { result, rerender } = renderHook(() => useRouter(), {
    wrapper: (props) => <Router>{props.children}</Router>,
  });
  const router = result.current;

  rerender();
  expect(result.current).toBe(router);
});

it("alters the current router with `parser` and `hook` options", () => {
  const newParser: Parser = () => ({ pattern: /(.*)/, keys: [] });
  const hook: BaseLocationHook = () => ["/foo", () => {}];

  const { result } = renderHook(() => useRouter(), {
    wrapper: (props) => (
      <Router parser={newParser} hook={hook}>
        {props.children}
      </Router>
    ),
  });
  const router = result.current;

  expect(router).toBeInstanceOf(Object);
  expect(router.parser).toBe(newParser);
  expect(router.hook).toBe(hook);
});

it("accepts `ssrPath` and `ssrSearch` params", () => {
  const { result } = renderHook(() => useRouter(), {
    wrapper: (props) => (
      <Router ssrPath="/users" ssrSearch="a=b&c=d">
        {props.children}
      </Router>
    ),
  });

  expect(result.current.ssrPath).toBe("/users");
  expect(result.current.ssrSearch).toBe("a=b&c=d");
});

it("can extract `ssrSearch` from `ssrPath` after the '?' symbol", () => {
  let ssrPath: string | undefined = "/no-search";
  let ssrSearch: string | undefined = undefined;

  const { result, rerender } = renderHook(() => useRouter(), {
    wrapper: (props) => (
      <Router ssrPath={ssrPath} ssrSearch={ssrSearch}>
        {props.children}
      </Router>
    ),
  });

  expect(result.current.ssrPath).toBe("/no-search");
  expect(result.current.ssrSearch).toBe(undefined);

  ssrPath = "/with-search?a=b&c=d";
  rerender();

  expect(result.current.ssrPath).toBe("/with-search");
  expect(result.current.ssrSearch).toBe("a=b&c=d");

  ssrSearch = "x=y&z=w";
  rerender();
  expect(result.current.ssrSearch).toBe("a=b&c=d");
});

it("shares one router instance between components", () => {
  const RouterGetter = ({ el }: { el: ReactElement }) => {
    const router = useRouter();
    return cloneElement(el, { router: router });
  };

  const { root } = TestRenderer.create(
    <>
      <RouterGetter el={<div />} />
      <RouterGetter el={<div />} />
      <RouterGetter el={<div />} />
      <RouterGetter el={<div />} />
    </>
  );

  const uniqRouters = [
    ...new Set<DefaultParams>(
      root.findAllByType("div").map((x) => x.props.router)
    ),
  ];
  expect(uniqRouters.length).toBe(1);
});

describe("`base` prop", () => {
  it("is an empty string by default", () => {
    const { result } = renderHook(() => useRouter());
    expect(result.current.base).toBe("");
  });

  it("can be customized via the `base` prop", () => {
    const { result } = renderHook(() => useRouter(), {
      wrapper: (props) => <Router base="/foo">{props.children}</Router>,
    });
    expect(result.current.base).toBe("/foo");
  });

  it("appends provided path to the parent router's base", () => {
    const { result } = renderHook(() => useRouter(), {
      wrapper: (props) => (
        <Router base="/baz">
          <Router base="/foo">
            <Router base="/bar">{props.children}</Router>
          </Router>
        </Router>
      ),
    });
    expect(result.current.base).toBe("/baz/foo/bar");
  });
});

describe("`hook` prop", () => {
  it("when provided, the router isn't inherited from the parent", () => {
    const customHook: BaseLocationHook = () => ["/foo", () => {}];
    const newParser: Parser = () => ({ pattern: /(.*)/, keys: [] });

    const {
      result: { current: router },
    } = renderHook(() => useRouter(), {
      wrapper: (props) => (
        <Router base="/app" parser={newParser}>
          <Router hook={customHook} base="/bar">
            {props.children}
          </Router>
        </Router>
      ),
    });

    expect(router.hook).toBe(customHook);
    expect(router.parser).not.toBe(newParser);
    expect(router.base).toBe("/bar");
  });
});

it("updates the context when settings are changed", () => {
  const state: { renders: number } & Partial<ComponentProps<typeof Router>> = {
    renders: 0,
  };

  const Memoized = memo((props) => {
    const router = useRouter();
    state.renders++;

    state.hook = router.hook;
    state.base = router.base;

    return <></>;
  });

  const { rerender } = render(
    <Router base="/app">
      <Memoized />
    </Router>
  );

  expect(state.renders).toEqual(1);
  expect(state.base).toBe("/app");

  rerender(
    <Router base="/app">
      <Memoized />
    </Router>
  );
  expect(state.renders).toEqual(1); // nothing changed

  // should re-render the hook
  const newHook: BaseLocationHook = () => ["/location", () => {}];
  rerender(
    <Router hook={newHook} base="/app">
      <Memoized />
    </Router>
  );
  expect(state.renders).toEqual(2);
  expect(state.base).toEqual("/app");
  expect(state.hook).toEqual(newHook);
});

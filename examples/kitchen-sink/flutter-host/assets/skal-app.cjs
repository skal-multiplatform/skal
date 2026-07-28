// @bun @bytecode @bun-cjs
(function(exports, require, module, __filename, __dirname) {// flutter-host/assets/skal-app.js
globalThis.__SKAL_BUILDER_PROPS__ = {};
(function() {
  var be = { context: undefined, registry: undefined, effects: undefined, done: false, getContextId() {
    return Un(this.context.count);
  }, getNextContextId() {
    return Un(this.context.count++);
  } };
  function Un(e) {
    const r = String(e), n = r.length - 1;
    return be.context.id + (n ? String.fromCharCode(96 + n) : "") + r;
  }
  function Mr(e) {
    be.context = e;
  }
  function $o() {
    return { ...be.context, id: be.getNextContextId(), count: 0 };
  }
  var Po = (e, r) => e === r, Le = Symbol("solid-proxy"), Ao = typeof Proxy == "function", dr = Symbol("solid-track"), hr = { equals: Po }, Gn = null, jn = ei, Ie = 1, Wt = 2, qn = { owned: null, cleanups: null, context: null, owner: null }, ne = null, W = null, Ht = null, Et = null, ie = null, ge = null, me = null, gr = 0;
  function nt(e, r) {
    const n = ie, i = ne, a = e.length === 0, l = r === undefined ? i : r, c = a ? qn : { owned: null, cleanups: null, context: l ? l.context : null, owner: l }, g = a ? e : () => e(() => ot(() => at(c)));
    ne = c, ie = null;
    try {
      return We(g, true);
    } finally {
      ie = n, ne = i;
    }
  }
  function q(e, r) {
    r = r ? Object.assign({}, hr, r) : hr;
    const n = { value: e, observers: null, observerSlots: null, comparator: r.equals || undefined }, i = (a) => (typeof a == "function" && (W && W.running && W.sources.has(n) ? a = a(n.tValue) : a = a(n.value)), Zn(n, a));
    return [Jn.bind(n), i];
  }
  function it(e, r, n) {
    const i = Wr(e, r, false, Ie);
    Ht && W && W.running ? ge.push(i) : Ut(i);
  }
  function Rt(e, r, n) {
    jn = Do;
    const i = Wr(e, r, false, Ie), a = Nr && Fo(Nr);
    a && (i.suspense = a), (!n || !n.render) && (i.user = true), me ? me.push(i) : Ut(i);
  }
  function pr(e, r, n) {
    n = n ? Object.assign({}, hr, n) : hr;
    const i = Wr(e, r, true, 0);
    return i.observers = null, i.observerSlots = null, i.comparator = n.equals || undefined, Ht && W && W.running ? (i.tState = Ie, ge.push(i)) : Ut(i), Jn.bind(i);
  }
  function Xn(e) {
    return We(e, false);
  }
  function ot(e) {
    if (!Et && ie === null)
      return e();
    const r = ie;
    ie = null;
    try {
      return Et ? Et.untrack(e) : e();
    } finally {
      ie = r;
    }
  }
  function Kn(e) {
    Rt(() => ot(e));
  }
  function ht(e) {
    return ne === null || (ne.cleanups === null ? ne.cleanups = [e] : ne.cleanups.push(e)), e;
  }
  function Br() {
    return ie;
  }
  function Vt() {
    return ne;
  }
  function Oo(e) {
    if (W && W.running)
      return e(), W.done;
    const r = ie, n = ne;
    return Promise.resolve().then(() => {
      ie = r, ne = n;
      let i;
      return (Ht || Nr) && (i = W || (W = { sources: new Set, effects: [], promises: new Set, disposed: new Set, queue: new Set, running: true }), i.done || (i.done = new Promise((a) => i.resolve = a)), i.running = true), We(e, false), ie = ne = null, i ? i.done : undefined;
    });
  }
  var [Hl, Yn] = q(false);
  function Fo(e) {
    let r;
    return ne && ne.context && (r = ne.context[e.id]) !== undefined ? r : e.defaultValue;
  }
  var Nr;
  function Jn() {
    const e = W && W.running;
    if (this.sources && (e ? this.tState : this.state))
      if ((e ? this.tState : this.state) === Ie)
        Ut(this);
      else {
        const r = ge;
        ge = null, We(() => _r(this), false), ge = r;
      }
    if (ie) {
      const r = this.observers;
      if (!r || r[r.length - 1] !== ie) {
        const n = r ? r.length : 0;
        ie.sources ? (ie.sources.push(this), ie.sourceSlots.push(n)) : (ie.sources = [this], ie.sourceSlots = [n]), r ? (r.push(ie), this.observerSlots.push(ie.sources.length - 1)) : (this.observers = [ie], this.observerSlots = [ie.sources.length - 1]);
      }
    }
    return e && W.sources.has(this) ? this.tValue : this.value;
  }
  function Zn(e, r, n) {
    let i = W && W.running && W.sources.has(e) ? e.tValue : e.value;
    if (!e.comparator || !e.comparator(i, r)) {
      if (W) {
        const a = W.running;
        (a || !n && W.sources.has(e)) && (W.sources.add(e), e.tValue = r), a || (e.value = r);
      } else
        e.value = r;
      e.observers && e.observers.length && We(() => {
        for (let a = 0;a < e.observers.length; a += 1) {
          const l = e.observers[a], c = W && W.running;
          c && W.disposed.has(l) || ((c ? !l.tState : !l.state) && (l.pure ? ge.push(l) : me.push(l), l.observers && ti(l)), c ? l.tState = Ie : l.state = Ie);
        }
        if (ge.length > 1e6)
          throw ge = [], new Error;
      }, false);
    }
    return r;
  }
  function Ut(e) {
    if (!e.fn)
      return;
    at(e);
    const r = gr;
    Qn(e, W && W.running && W.sources.has(e) ? e.tValue : e.value, r), W && !W.running && W.sources.has(e) && queueMicrotask(() => {
      We(() => {
        W && (W.running = true), ie = ne = e, Qn(e, e.tValue, r), ie = ne = null;
      }, false);
    });
  }
  function Qn(e, r, n) {
    let i;
    const a = ne, l = ie;
    ie = ne = e;
    try {
      i = e.fn(r);
    } catch (c) {
      return e.pure && (W && W.running ? (e.tState = Ie, e.tOwned && e.tOwned.forEach(at), e.tOwned = undefined) : (e.state = Ie, e.owned && e.owned.forEach(at), e.owned = null)), e.updatedAt = n + 1, Hr(c);
    } finally {
      ie = l, ne = a;
    }
    (!e.updatedAt || e.updatedAt <= n) && (e.updatedAt != null && ("observers" in e) ? Zn(e, i, true) : W && W.running && e.pure ? (W.sources.has(e) || (e.value = i), W.sources.add(e), e.tValue = i) : e.value = i, e.updatedAt = n);
  }
  function Wr(e, r, n, i = Ie, a) {
    const l = { fn: e, state: i, updatedAt: null, owned: null, sources: null, sourceSlots: null, cleanups: null, value: r, owner: ne, context: ne ? ne.context : null, pure: n };
    if (W && W.running && (l.state = 0, l.tState = i), ne === null || ne !== qn && (W && W.running && ne.pure ? ne.tOwned ? ne.tOwned.push(l) : ne.tOwned = [l] : ne.owned ? ne.owned.push(l) : ne.owned = [l]), Et && l.fn) {
      const c = l.fn, [g, f] = q(undefined, { equals: false }), _ = Et.factory(c, f);
      ht(() => _.dispose());
      let S;
      const w = () => Oo(f).then(() => {
        S && (S.dispose(), S = undefined);
      });
      l.fn = (P) => (g(), W && W.running ? (S || (S = Et.factory(c, w)), S.track(P)) : _.track(P));
    }
    return l;
  }
  function Gt(e) {
    const r = W && W.running;
    if ((r ? e.tState : e.state) === 0)
      return;
    if ((r ? e.tState : e.state) === Wt)
      return _r(e);
    if (e.suspense && ot(e.suspense.inFallback))
      return e.suspense.effects.push(e);
    const n = [e];
    for (;(e = e.owner) && (!e.updatedAt || e.updatedAt < gr); ) {
      if (r && W.disposed.has(e))
        return;
      (r ? e.tState : e.state) && n.push(e);
    }
    for (let i = n.length - 1;i >= 0; i--) {
      if (e = n[i], r) {
        let a = e, l = n[i + 1];
        for (;(a = a.owner) && a !== l; )
          if (W.disposed.has(a))
            return;
      }
      if ((r ? e.tState : e.state) === Ie)
        Ut(e);
      else if ((r ? e.tState : e.state) === Wt) {
        const a = ge;
        ge = null, We(() => _r(e, n[0]), false), ge = a;
      }
    }
  }
  function We(e, r) {
    if (ge)
      return e();
    let n = false;
    r || (ge = []), me ? n = true : me = [], gr++;
    try {
      const i = e();
      return Co(n), i;
    } catch (i) {
      n || (me = null), ge = null, Hr(i);
    }
  }
  function Co(e) {
    if (ge && (Ht && W && W.running ? Io(ge) : ei(ge), ge = null), e)
      return;
    let r;
    if (W) {
      if (!W.promises.size && !W.queue.size) {
        const { sources: i, disposed: a } = W;
        me.push.apply(me, W.effects), r = W.resolve;
        for (const l of me)
          "tState" in l && (l.state = l.tState), delete l.tState;
        W = null, We(() => {
          for (const l of a)
            at(l);
          for (const l of i) {
            if (l.value = l.tValue, l.owned)
              for (let c = 0, g = l.owned.length;c < g; c++)
                at(l.owned[c]);
            l.tOwned && (l.owned = l.tOwned), delete l.tValue, delete l.tOwned, l.tState = 0;
          }
          Yn(false);
        }, false);
      } else if (W.running) {
        W.running = false, W.effects.push.apply(W.effects, me), me = null, Yn(true);
        return;
      }
    }
    const n = me;
    me = null, n.length && We(() => jn(n), false), r && r();
  }
  function ei(e) {
    for (let r = 0;r < e.length; r++)
      Gt(e[r]);
  }
  function Io(e) {
    for (let r = 0;r < e.length; r++) {
      const n = e[r], i = W.queue;
      i.has(n) || (i.add(n), Ht(() => {
        i.delete(n), We(() => {
          W.running = true, Gt(n);
        }, false), W && (W.running = false);
      }));
    }
  }
  function Do(e) {
    let r, n = 0;
    for (r = 0;r < e.length; r++) {
      const i = e[r];
      i.user ? e[n++] = i : Gt(i);
    }
    if (be.context) {
      if (be.count) {
        be.effects || (be.effects = []), be.effects.push(...e.slice(0, n));
        return;
      }
      Mr();
    }
    for (be.effects && (be.done || !be.count) && (e = [...be.effects, ...e], n += be.effects.length, delete be.effects), r = 0;r < n; r++)
      Gt(e[r]);
  }
  function _r(e, r) {
    const n = W && W.running;
    n ? e.tState = 0 : e.state = 0;
    for (let i = 0;i < e.sources.length; i += 1) {
      const a = e.sources[i];
      if (a.sources) {
        const l = n ? a.tState : a.state;
        l === Ie ? a !== r && (!a.updatedAt || a.updatedAt < gr) && Gt(a) : l === Wt && _r(a, r);
      }
    }
  }
  function ti(e) {
    const r = W && W.running;
    for (let n = 0;n < e.observers.length; n += 1) {
      const i = e.observers[n];
      (r ? !i.tState : !i.state) && (r ? i.tState = Wt : i.state = Wt, i.pure ? ge.push(i) : me.push(i), i.observers && ti(i));
    }
  }
  function at(e) {
    let r;
    if (e.sources)
      for (;e.sources.length; ) {
        const n = e.sources.pop(), i = e.sourceSlots.pop(), a = n.observers;
        if (a && a.length) {
          const l = a.pop(), c = n.observerSlots.pop();
          i < a.length && (l.sourceSlots[c] = i, a[i] = l, n.observerSlots[i] = c);
        }
      }
    if (e.tOwned) {
      for (r = e.tOwned.length - 1;r >= 0; r--)
        at(e.tOwned[r]);
      delete e.tOwned;
    }
    if (W && W.running && e.pure)
      ri(e, true);
    else if (e.owned) {
      for (r = e.owned.length - 1;r >= 0; r--)
        at(e.owned[r]);
      e.owned = null;
    }
    if (e.cleanups) {
      for (r = e.cleanups.length - 1;r >= 0; r--)
        e.cleanups[r]();
      e.cleanups = null;
    }
    W && W.running ? e.tState = 0 : e.state = 0;
  }
  function ri(e, r) {
    if (r || (e.tState = 0, W.disposed.add(e)), e.owned)
      for (let n = 0;n < e.owned.length; n++)
        ri(e.owned[n]);
  }
  function zo(e) {
    return e instanceof Error ? e : new Error(typeof e == "string" ? e : "Unknown error", { cause: e });
  }
  function ni(e, r, n) {
    try {
      for (const i of r)
        i(e);
    } catch (i) {
      Hr(i, n && n.owner || null);
    }
  }
  function Hr(e, r = ne) {
    const n = Gn && r && r.context && r.context[Gn], i = zo(e);
    if (!n)
      throw i;
    me ? me.push({ fn() {
      ni(i, n, r);
    }, state: Ie }) : ni(i, n, r);
  }
  var Lo = Symbol("fallback");
  function ii(e) {
    for (let r = 0;r < e.length; r++)
      e[r]();
  }
  function Mo(e, r, n = {}) {
    let i = [], a = [], l = [], c = 0, g = r.length > 1 ? [] : null;
    return ht(() => ii(l)), () => {
      let f = e() || [], _ = f.length, S, w;
      return f[dr], ot(() => {
        let p, I, R, F, z, E, A, h, y;
        if (_ === 0)
          c !== 0 && (ii(l), l = [], i = [], a = [], c = 0, g && (g = [])), n.fallback && (i = [Lo], a[0] = nt(($) => (l[0] = $, n.fallback())), c = 1);
        else if (c === 0) {
          for (a = new Array(_), w = 0;w < _; w++)
            i[w] = f[w], a[w] = nt(P);
          c = _;
        } else {
          for (R = new Array(_), F = new Array(_), g && (z = new Array(_)), E = 0, A = Math.min(c, _);E < A && i[E] === f[E]; E++)
            ;
          for (A = c - 1, h = _ - 1;A >= E && h >= E && i[A] === f[h]; A--, h--)
            R[h] = a[A], F[h] = l[A], g && (z[h] = g[A]);
          for (p = new Map, I = new Array(h + 1), w = h;w >= E; w--)
            y = f[w], S = p.get(y), I[w] = S === undefined ? -1 : S, p.set(y, w);
          for (S = E;S <= A; S++)
            y = i[S], w = p.get(y), w !== undefined && w !== -1 ? (R[w] = a[S], F[w] = l[S], g && (z[w] = g[S]), w = I[w], p.set(y, w)) : l[S]();
          for (w = E;w < _; w++)
            w in R ? (a[w] = R[w], l[w] = F[w], g && (g[w] = z[w], g[w](w))) : a[w] = nt(P);
          a = a.slice(0, c = _), i = f.slice(0);
        }
        return a;
      });
      function P(p) {
        if (l[w] = p, g) {
          const [I, R] = q(w);
          return g[w] = R, r(f[w], I);
        }
        return r(f[w]);
      }
    };
  }
  var Bo = false;
  function No(e, r) {
    if (Bo && be.context) {
      const n = be.context;
      Mr($o());
      const i = ot(() => e(r || {}));
      return Mr(n), i;
    }
    return ot(() => e(r || {}));
  }
  function br() {
    return true;
  }
  var Wo = { get(e, r, n) {
    return r === Le ? n : e.get(r);
  }, has(e, r) {
    return r === Le ? true : e.has(r);
  }, set: br, deleteProperty: br, getOwnPropertyDescriptor(e, r) {
    return { configurable: true, enumerable: true, get() {
      return e.get(r);
    }, set: br, deleteProperty: br };
  }, ownKeys(e) {
    return e.keys();
  } };
  function Vr(e) {
    return (e = typeof e == "function" ? e() : e) ? e : {};
  }
  function Ho() {
    for (let e = 0, r = this.length;e < r; ++e) {
      const n = this[e]();
      if (n !== undefined)
        return n;
    }
  }
  function oi(...e) {
    let r = false;
    for (let c = 0;c < e.length; c++) {
      const g = e[c];
      r = r || !!g && Le in g, e[c] = typeof g == "function" ? (r = true, pr(g)) : g;
    }
    if (Ao && r)
      return new Proxy({ get(c) {
        for (let g = e.length - 1;g >= 0; g--) {
          const f = Vr(e[g])[c];
          if (f !== undefined)
            return f;
        }
      }, has(c) {
        for (let g = e.length - 1;g >= 0; g--)
          if (c in Vr(e[g]))
            return true;
        return false;
      }, keys() {
        const c = [];
        for (let g = 0;g < e.length; g++)
          c.push(...Object.keys(Vr(e[g])));
        return [...new Set(c)];
      } }, Wo);
    const n = {}, i = Object.create(null);
    for (let c = e.length - 1;c >= 0; c--) {
      const g = e[c];
      if (!g)
        continue;
      const f = Object.getOwnPropertyNames(g);
      for (let _ = f.length - 1;_ >= 0; _--) {
        const S = f[_];
        if (S === "__proto__" || S === "constructor")
          continue;
        const w = Object.getOwnPropertyDescriptor(g, S);
        if (!i[S])
          i[S] = w.get ? { enumerable: true, configurable: true, get: Ho.bind(n[S] = [w.get.bind(g)]) } : w.value !== undefined ? w : undefined;
        else {
          const P = n[S];
          P && (w.get ? P.push(w.get.bind(g)) : w.value !== undefined && P.push(() => w.value));
        }
      }
    }
    const a = {}, l = Object.keys(i);
    for (let c = l.length - 1;c >= 0; c--) {
      const g = l[c], f = i[g];
      f && f.get ? Object.defineProperty(a, g, f) : a[g] = f ? f.value : undefined;
    }
    return a;
  }
  function ue(e) {
    const r = "fallback" in e && { fallback: () => e.fallback };
    return pr(Mo(() => e.each, e.children, r || undefined));
  }
  var Vo = (e) => pr(() => e());
  function Uo({ createElement: e, createTextNode: r, isTextNode: n, replaceText: i, insertNode: a, removeNode: l, setProperty: c, getParentNode: g, getFirstChild: f, getNextSibling: _ }) {
    function S(E, A, h, y) {
      if (h !== undefined && !y && (y = []), typeof A != "function")
        return w(E, A, y, h);
      it(($) => w(E, A(), $, h), y);
    }
    function w(E, A, h, y, $) {
      for (;typeof h == "function"; )
        h = h();
      if (A === h)
        return h;
      const D = typeof A, M = y !== undefined;
      if (D === "string" || D === "number")
        if (D === "number" && (A = A.toString()), M) {
          let U = h[0];
          U && n(U) ? i(U, A) : U = r(A), h = I(E, h, y, U);
        } else
          h !== "" && typeof h == "string" ? i(f(E), h = A) : (I(E, h, y, r(A)), h = A);
      else if (A == null || D === "boolean")
        h = I(E, h, y);
      else {
        if (D === "function")
          return it(() => {
            let U = A();
            for (;typeof U == "function"; )
              U = U();
            h = w(E, U, h, y);
          }), () => h;
        if (Array.isArray(A)) {
          const U = [];
          if (P(U, A, $))
            return it(() => h = w(E, U, h, y, true)), () => h;
          if (U.length === 0) {
            const de = I(E, h, y);
            if (M)
              return h = de;
          } else
            Array.isArray(h) ? h.length === 0 ? R(E, U, y) : p(E, h, U) : h == null || h === "" ? R(E, U) : p(E, M && h || [f(E)], U);
          h = U;
        } else {
          if (Array.isArray(h)) {
            if (M)
              return h = I(E, h, y, A);
            I(E, h, null, A);
          } else
            h == null || h === "" || !f(E) ? a(E, A) : F(E, A, f(E));
          h = A;
        }
      }
      return h;
    }
    function P(E, A, h) {
      let y = false;
      for (let $ = 0, D = A.length;$ < D; $++) {
        let M = A[$], U;
        if (!(M == null || M === true || M === false))
          if (Array.isArray(M))
            y = P(E, M) || y;
          else if ((U = typeof M) == "string" || U === "number")
            E.push(r(M));
          else if (U === "function")
            if (h) {
              for (;typeof M == "function"; )
                M = M();
              y = P(E, Array.isArray(M) ? M : [M]) || y;
            } else
              E.push(M), y = true;
          else
            E.push(M);
      }
      return y;
    }
    function p(E, A, h) {
      let y = h.length, $ = A.length, D = y, M = 0, U = 0, de = _(A[$ - 1]), ce = null;
      for (;M < $ || U < D; ) {
        if (A[M] === h[U]) {
          M++, U++;
          continue;
        }
        for (;A[$ - 1] === h[D - 1]; )
          $--, D--;
        if ($ === M) {
          const le = D < y ? U ? _(h[U - 1]) : h[D - U] : de;
          for (;U < D; )
            a(E, h[U++], le);
        } else if (D === U)
          for (;M < $; )
            (!ce || !ce.has(A[M])) && l(E, A[M]), M++;
        else if (A[M] === h[D - 1] && h[U] === A[$ - 1]) {
          const le = _(A[--$]);
          a(E, h[U++], _(A[M++])), a(E, h[--D], le), A[$] = h[D];
        } else {
          if (!ce) {
            ce = new Map;
            let Be = U;
            for (;Be < D; )
              ce.set(h[Be], Be++);
          }
          const le = ce.get(A[M]);
          if (le != null)
            if (U < le && le < D) {
              let Be = M, pe = 1, Pe;
              for (;++Be < $ && Be < D && !((Pe = ce.get(A[Be])) == null || Pe !== le + pe); )
                pe++;
              if (pe > le - U) {
                const or = A[M];
                for (;U < le; )
                  a(E, h[U++], or);
              } else
                F(E, h[U++], A[M++]);
            } else
              M++;
          else
            l(E, A[M++]);
        }
      }
    }
    function I(E, A, h, y) {
      if (h === undefined) {
        let D;
        for (;D = f(E); )
          l(E, D);
        return y && a(E, y), "";
      }
      const $ = y || r("");
      if (A.length) {
        let D = false;
        for (let M = A.length - 1;M >= 0; M--) {
          const U = A[M];
          if ($ !== U) {
            const de = g(U) === E;
            !D && !M ? de ? F(E, $, U) : a(E, $, h) : de && l(E, U);
          } else
            D = true;
        }
      } else
        a(E, $, h);
      return [$];
    }
    function R(E, A, h) {
      for (let y = 0, $ = A.length;y < $; y++)
        a(E, A[y], h);
    }
    function F(E, A, h) {
      a(E, A, h), l(E, h);
    }
    function z(E, A, h = {}, y) {
      return A || (A = {}), y || it(() => h.children = w(E, A.children, h.children)), it(() => A.ref && A.ref(E)), it(() => {
        for (const $ in A) {
          if ($ === "children" || $ === "ref")
            continue;
          const D = A[$];
          D !== h[$] && (c(E, $, D, h[$]), h[$] = D);
        }
      }), h;
    }
    return { render(E, A) {
      let h;
      return nt((y) => {
        h = y, S(A, E());
      }), h;
    }, insert: S, spread(E, A, h) {
      typeof A == "function" ? it((y) => z(E, A(), y, h)) : z(E, A, undefined, h);
    }, createElement: e, createTextNode: r, insertNode: a, setProp(E, A, h, y) {
      return c(E, A, h, y), h;
    }, mergeProps: oi, effect: it, memo: Vo, createComponent: No, use(E, A, h) {
      return ot(() => E(A, h));
    } };
  }
  function ai(e) {
    const r = Uo(e);
    return r.mergeProps = oi, r;
  }
  function Go() {
    const e = globalThis.__skalHot;
    if (e)
      return e;
    const r = { currentDrain: null, setDrain(i) {
      this.currentDrain = i;
    }, stash: new Map, _cfg: null, configure(i) {
      this._cfg = Object.assign({}, this._cfg, i);
    }, _mounted: false, _dispose: null, mount(i) {
      if (this._mounted)
        return;
      const a = this._cfg;
      this._dispose = a ? a.render(i) : null, this._mounted = true;
    }, beginReload() {
      const i = this._cfg;
      try {
        this._dispose && this._dispose();
      } catch {}
      this._dispose = null, this._mounted = false;
      try {
        i && i.cleanup && i.cleanup();
      } catch {}
      try {
        i && i.reset && i.reset();
      } catch {}
    } }, n = function() {
      const i = globalThis.__skalHot && globalThis.__skalHot.currentDrain;
      i && i();
    };
    return n.__skalTrampoline = true, globalThis.__skal_drainEvents = n, globalThis.__skalHot = r, r;
  }
  var si = 6 * 1024 * 1024, jt = 4194368, jo = 768 * 1024, li = 4980800, ci = 4980800, ui = 2, fi = 3, qo = 6, di = 7, Xo = 10, hi = 12, gi = 0, Ko = 2, pi = 4, Vl = 1, Ul = 2, Gl = 3, jl = 4, ql = 16, Xl = 17, Kl = 20, Yl = 21, Jl = 22, Zl = 23, Ql = 24, ec = 25, tc = 26, rc = 44, nc = 45, ic = 27, oc = 28, ac = 29, sc = 30, lc = 31, cc = 32, uc = 33, fc = 34, dc = 35, hc = 36, gc = 37, pc = 38, _c = 39, bc = 40, vc = 41, mc = 42, wc = 43, Sc = 0, yc = 1, xc = 2, kc = 3, Tc = 4, Ec = 5, Rc = 6, $c = 7, Pc = 9, Ac = 10, Oc = 11, Fc = 12, Cc = 13, Ic = 14, Dc = 15, zc = 16, Lc = 17, Mc = 18, Bc = 19, Nc = 20, Wc = 21, Hc = 22, Vc = 23, Uc = 24, Gc = 25, jc = 26, qc = 27, Xc = 28, Kc = 29, Yc = 30, Jc = 31, Zc = 32, Qc = 33, eu = 34, tu = 35, ru = 36, nu = 37, iu = 38, ou = 39, au = 40, su = 41, lu = 42, cu = 43, uu = 44, fu = 45, du = 46, hu = 47, gu = 48, pu = 49, _u = 1, bu = 2, vu = 3, mu = 4, wu = 5, Su = 6, yu = 7, xu = 8, ku = 9, Tu = 10, Eu = 11, Ru = 12, $u = 13, Pu = 14, Au = 15, Ou = 16, Fu = 17, Cu = 18, Iu = 19, Du = 20, zu = 21, Lu = 22, Mu = 23, Bu = 24, Nu = 0, Wu = 1, Hu = 2, Vu = 3, Uu = 4, Gu = 5, ju = 6, qu = 7, Xu = 0, Ku = 1, Yu = 2, Ju = 3, Zu = 4, Qu = 5, ef = 6, tf = 7, rf = 8, nf = 9, of = 10, af = 11, sf = 12, lf = 13, cf = 14, uf = 15, ff = 16, df = 17, hf = 32, gf = 33, pf = 34, _f = 35, bf = 36, vf = 37, mf = 64, wf = 65, Sf = 66, yf = 67, xf = 68, kf = 69, Tf = 70, Ef = 71, Rf = 72, $f = 73, Pf = 74, Af = 75, Of = 76, Ff = 96, Cf = 97, If = 98, Df = 99, zf = 128, Lf = 129, Mf = 130, Bf = 131, Nf = 132, Wf = 133, Hf = 134, Vf = 135, Uf = 136, Gf = 137, jf = 160, qf = 161, Xf = 162, Kf = 163, Yf = 164, Jf = 165, Zf = 166, Qf = 167, ed = 168, td = 169, rd = 170, nd = 171, id = 172, od = 173, ad = 174, sd = 175, ld = 176, cd = 177, ud = 178, fd = 179, dd = 180, hd = 181, gd = 182, pd = 183, _d = -1, Yo = 2147483646, Jo = 2147483645, vr = typeof globalThis.__skal_acquireBridge == "function", Ye;
  if (vr) {
    if (Ye = globalThis.__skal_acquireBridge(), !Ye || Ye.byteLength !== si)
      throw new Error(`Skal: bridge buffer not available (got ${Ye && Ye.byteLength})`);
  } else
    Ye = new ArrayBuffer(si);
  var Ur = new Uint8Array(Ye), _e = new Uint32Array(Ye), qt = new BigInt64Array(Ye), Zo = new TextEncoder, Xt = 16, Qo = 1048592, ea = 16384, ta = Qo - 4, _i = _e[ui], bi = _e[fi], Kt = Atomics.load(qt, gi), Je = _i ? (_i >> 2) + Xt : Xt, $t = bi ? bi + jt : jt, mr = Je, Gr = false, jr = false, qr = false;
  function Xr() {
    Je = Xt, $t = jt, mr = Xt, Gr = true;
  }
  function Kr() {
    _e[ui] = Je - Xt << 2, _e[fi] = $t - jt, Gr && (_e[hi] = _e[hi] + 1 >>> 0, Gr = false), Kt += 1n, Atomics.store(qt, gi, Kt), mr = Je, vi();
  }
  function vi() {
    Si && (Atomics.load(qt, pi) < yi || (yi = Kt, Si()));
  }
  function mi() {
    qr = true;
    try {
      Kr();
      const e = Kt, r = globalThis.__skal_drainOpsSync;
      if (typeof r == "function") {
        if (globalThis.__skal_opRingResets = (globalThis.__skal_opRingResets | 0) + 1, jr)
          console.warn("Skal: op ring re-overflowed during inline drain \u2014 chunk large renders to avoid stale ops");
        else {
          jr = true;
          try {
            r();
          } finally {
            jr = false;
          }
        }
        Xr();
        return;
      }
      const n = performance.now() + 5000;
      for (;!(Atomics.load(qt, pi) >= e); )
        if (performance.now() > n) {
          console.warn("Skal: drain spin timeout \u2014 UI thread slow; ring will overwrite");
          break;
        }
      Xr();
    } finally {
      qr = false;
    }
  }
  function ee(e, r, n, i) {
    let a = Je;
    a >= ta && (mi(), a = Je), _e[a] = e >>> 0, _e[a + 1] = r >>> 0, _e[a + 2] = n >>> 0, _e[a + 3] = i >>> 0, Je = a + 4, Je - mr >= ea && Kr();
  }
  var Ze = 0, He = 0;
  function st(e) {
    $t + e.length * 3 > ci && mi();
    const r = $t - jt, n = Ur.subarray($t, ci), { read: i, written: a } = Zo.encodeInto(e, n);
    if (i !== e.length)
      throw new Error(`Skal: string too large for heap (${e.length} code units > ${jo} bytes)`);
    $t += a, Ze = r, He = a;
  }
  function wr(e, r) {
    st(r), ee(20, e, Ze, He);
  }
  var wi = 8192, ra = (e, r) => typeof r == "bigint" ? `${r}n` : r;
  function na(e) {
    if (typeof e == "string")
      return e;
    if (e instanceof Error)
      return e.stack || e.message || String(e);
    if (typeof e == "object" && e !== null)
      try {
        return JSON.stringify(e, ra);
      } catch {
        return String(e);
      }
    return String(e);
  }
  var Yr = false;
  function gt(e, r) {
    if (!(Yr || qr)) {
      Yr = true;
      try {
        let n = "";
        for (let i = 0;i < r.length; i++)
          i && (n += " "), n += na(r[i]);
        if (n.length === 0)
          return;
        n.length > wi && (n = n.slice(0, wi) + "\u2026"), st(n), ee(40, e, Ze, He), te();
      } catch {} finally {
        Yr = false;
      }
    }
  }
  function ia() {
    const e = { log: function() {
      gt(0, arguments);
    }, info: function() {
      gt(1, arguments);
    }, warn: function() {
      gt(2, arguments);
    }, error: function() {
      gt(3, arguments);
    }, debug: function() {
      gt(4, arguments);
    }, trace: function() {
      gt(4, arguments);
    } };
    e.dir = e.log, e.dirxml = e.log, e.table = e.log, e.group = e.log, e.groupCollapsed = e.log, e.assert = function(n) {
      if (!n) {
        const i = Array.prototype.slice.call(arguments, 1);
        gt(3, ["Assertion failed:"].concat(i));
      }
    };
    const r = function() {};
    globalThis.console = new Proxy(e, { get(n, i) {
      const a = n[i];
      return a !== undefined ? a : r;
    } });
  }
  vr && typeof window > "u" && ia();
  var Jr = false, Si = typeof globalThis.__skal_notifyHost == "function" ? globalThis.__skal_notifyHost : null, Zr = false, yi = 0n;
  function xi(e) {
    e === 1 && (Zr = true);
  }
  function ki() {
    Jr = false, Je !== mr ? Kr() : Zr && vi(), Zr = false;
  }
  function te() {
    Jr || (Jr = true, queueMicrotask(ki));
  }
  function oa() {
    Xr(), ee(41, 1, 0, 0), ki();
  }
  var Ve = 1024, V = new Int8Array(256);
  V.fill(-1), V[0] = 0, V[1] = 1, V[2] = 2, V[3] = 3, V[4] = 4, V[5] = 5, V[6] = 6, V[7] = 7, V[8] = 8, V[9] = 9, V[32] = 10, V[33] = 11, V[34] = 12, V[35] = 13, V[36] = 14, V[37] = 15, V[64] = 16, V[65] = 17, V[66] = 18, V[67] = 19, V[68] = 20, V[69] = 21, V[70] = 22, V[96] = 23, V[97] = 24, V[128] = 25, V[129] = 26, V[130] = 27, V[131] = 28, V[160] = 29, V[161] = 30, V[162] = 31, V[10] = 32, V[11] = 33, V[12] = 34, V[13] = 35, V[14] = 36, V[15] = 37, V[16] = 38, V[132] = 39, V[133] = 40, V[134] = 41, V[135] = 42, V[136] = 43, V[163] = 44, V[164] = 45, V[165] = 46, V[166] = 47, V[71] = 48, V[98] = 49, V[137] = 50, V[72] = 51, V[167] = 52, V[168] = 53, V[169] = 54, V[170] = 55, V[171] = 56, V[172] = 57, V[173] = 58, V[174] = 59, V[73] = 60, V[99] = 61, V[175] = 62, V[74] = 63;
  var Ee = 64, Sr = new Int32Array(Ve * Ee), Pt = new Float32Array(Ve * Ee), Yt = new Array(Ve * Ee), Ti = 1, aa = 2, sa = 4, Qe = new Uint8Array(Ve * Ee), At = 6, Ot = new Float32Array(Ve * At);
  Ot.fill(NaN);
  var yr = new Map, Ei = [], la = 0;
  function ca() {
    const e = Ve * 2, r = Ve * Ee, n = e * Ee, i = Ve * At, a = e * At, l = new Int32Array(n);
    l.set(Sr), Sr = l;
    const c = new Uint8Array(n);
    c.set(Qe), Qe = c;
    const g = new Float32Array(n);
    g.set(Pt), g.fill(NaN, r), Pt = g;
    const f = new Float32Array(a);
    f.set(Ot), f.fill(NaN, i), Ot = f, Yt.length = n, Ve = e;
  }
  function Jt(e) {
    let r = yr.get(e);
    if (r === undefined) {
      r = Ei.pop(), r === undefined && (r = la++), r >= Ve && ca(), yr.set(e, r);
      const n = r * Ee;
      Qe.fill(0, n, n + Ee), Pt.fill(NaN, n, n + Ee);
      for (let i = n;i < n + Ee; i++)
        Yt[i] = undefined;
    }
    return r;
  }
  var Qr = new Map, en = new Map, tn = new Map, Ft = new Map;
  function rn(e, r) {
    const n = Ft.get(e);
    n && (n.delete(r), n.size === 0 && Ft.delete(e));
  }
  function ua(e) {
    const r = yr.get(e);
    if (r !== undefined) {
      yr.delete(e), Ei.push(r);
      const n = r * At;
      Ot.fill(NaN, n, n + At);
    }
    Qr.delete(e), en.delete(e), tn.delete(e), Ia(e);
  }
  var Ae = 0, et = 0, Ct = new Float32Array(1), Zt = new Uint32Array(Ct.buffer);
  function we(e, r, n) {
    const i = n | 0, a = V[r];
    if (a < 0) {
      ee(16, e, r, i), Ae++;
      return;
    }
    const l = Jt(e) * Ee + a;
    if ((Qe[l] & Ti) !== 0 && Sr[l] === i) {
      et++;
      return;
    }
    Sr[l] = i, Qe[l] |= Ti, ee(16, e, r, i), Ae++;
  }
  function fa(e, r) {
    const n = V[r];
    if (n >= 0) {
      const i = Jt(e) * Ee + n;
      if (Qe[i] === 0) {
        et++;
        return;
      }
      Qe[i] = 0, Pt[i] = NaN, Yt[i] = undefined;
    }
    ee(45, e, r, 0), Ae++;
  }
  function Ri(e, r, n) {
    const i = V[r];
    if (i < 0) {
      Ct[0] = n, ee(17, e, r, Zt[0]), Ae++;
      return;
    }
    const a = Jt(e) * Ee + i;
    if (Pt[a] === n) {
      et++;
      return;
    }
    Pt[a] = n, Qe[a] |= aa, Ct[0] = n, ee(17, e, r, Zt[0]), Ae++;
  }
  function da(e, r, n) {
    const i = V[r];
    if (i < 0) {
      st(n == null ? "" : String(n)), ee(22, e, (r & 255) << 24 | Ze & 16777215, He), Ae++;
      return;
    }
    const a = Jt(e) * Ee + i;
    if (Yt[a] === n) {
      et++;
      return;
    }
    Yt[a] = n, Qe[a] |= sa, st(n == null ? "" : String(n)), ee(22, e, (r & 255) << 24 | Ze & 16777215, He), Ae++;
  }
  function It(e, r, n, i) {
    const a = Jt(e) * At + n;
    if (Ot[a] === i) {
      et++;
      return;
    }
    Ot[a] = i, Ct[0] = i, ee(r, e, 0, Zt[0]), Ae++;
  }
  function ha(e, r) {
    It(e, 32, 0, r);
  }
  function ga(e, r) {
    It(e, 33, 1, r);
  }
  function pa(e, r) {
    It(e, 34, 2, r);
  }
  function _a(e, r) {
    It(e, 35, 3, r);
  }
  function ba(e, r) {
    It(e, 36, 4, r);
  }
  function va(e, r) {
    It(e, 37, 5, r);
  }
  var ma = { material: 0, cupertino: 1, adaptive: 2 }, wa = { light: 0, dark: 1 };
  function Sa(e, r) {
    ee(38, typeof e == "string" ? ma[e] ?? 0 : e | 0, typeof r == "string" ? wa[r] ?? 0 : r | 0, 0), te();
  }
  function ya(e) {
    ee(39, e, 0, 0), te();
  }
  function xa(e, r, n) {
    ee(42, e, r, n);
  }
  function ka(e, r) {
    ee(43, e, r, 0);
  }
  function $i(e) {
    return _t(1, "showDialog", [JSON.stringify(e || {})]);
  }
  function Ta(e) {
    return _t(1, "showActionSheet", [JSON.stringify(e || {})]);
  }
  function Pi(e) {
    return _t(1, "showSnackbar", [JSON.stringify(typeof e == "string" ? { message: e } : e || {})]);
  }
  function Ea(e) {
    return _t(1, "showDatePicker", [JSON.stringify(e || {})]);
  }
  function Ra(e) {
    return _t(1, "showTimePicker", [JSON.stringify(e || {})]);
  }
  function $a() {
    return _t(1, "getDataDir", []);
  }
  var Ai = new Map;
  function Pa(e) {
    let r = 2166136261;
    for (let n = 0;n < e.length; n++)
      r ^= e.charCodeAt(n), r = Math.imul(r, 16777619) >>> 0;
    return r;
  }
  function lt(e) {
    let r = Ai.get(e);
    return r !== undefined || (r = Pa(e), st(e), ee(23, r, Ze, He), Ai.set(e, r)), r;
  }
  function Aa(e, r) {
    ee(4, e, lt(r), 0);
  }
  function nn(e, r) {
    let n = e.get(r);
    return n === undefined && (n = new Map, e.set(r, n)), n;
  }
  function Oi(e, r, n) {
    const i = lt(r), a = n >>> 0, l = nn(Qr, e);
    if (l.get(i) === a) {
      et++;
      return;
    }
    l.set(i, a), ee(24, e, i, a), Ae++;
  }
  function Fi(e, r, n) {
    const i = lt(r), a = nn(en, e);
    if (a.get(i) === n) {
      et++;
      return;
    }
    a.set(i, n), Ct[0] = n, ee(25, e, i, Zt[0]), Ae++;
  }
  var on = 255, Ci = new Set;
  function Ii(e, r, n) {
    const i = lt(r), a = n == null ? "" : String(n), l = nn(tn, e);
    if (l.get(i) === a) {
      et++;
      return;
    }
    l.set(i, a), st(a);
    const c = Ze;
    let g = He;
    if (g > on) {
      for (g = on;g > 0 && (Ur[4194368 + c + g] & 192) === 128; )
        g--;
      ee(26, e, i, (c & 16777215) << 8 | g), Ae++, Ci.has(r) || (Ci.add(r), console.warn(`Skal: custom prop "${r}" is ${He} UTF-8 bytes; the wire format carries at most ${on}. Truncated to ${g}. Use an enum-keyed prop, or split the value across several props.`));
      return;
    }
    ee(26, e, i, (c & 16777215) << 8 | g), Ae++;
  }
  function Oa(e, r) {
    const n = lt(r);
    Qr.get(e)?.delete(n), en.get(e)?.delete(n), tn.get(e)?.delete(n), ee(44, e, n, 0);
  }
  function Fa(e, r, n) {
    ee(27, e, lt(r), n);
  }
  var pt = new Map, Ue = new Map, an = globalThis.__skalNextCallId || 1;
  function Di(e, r, n) {
    try {
      st(r);
    } catch {
      return console.warn(`[skal] RPC arg dropped: string/JSON arg exceeds the string heap (${r.length} chars). Pass a path or handle instead of bulk bytes \u2014 see PERFORMANCE.md payload law.`), false;
    }
    const i = Ze >>> 0;
    return ee(29, e, n | (He & 16777215) << 8, i), true;
  }
  function zi(e, r) {
    for (let n = 0;n < r.length; n++) {
      const i = r[n];
      if (typeof i == "number")
        if (Number.isInteger(i) && i >= -2147483648 && i <= 2147483647)
          ee(29, e, 1, i | 0);
        else if (!Number.isInteger(i) && Math.fround(i) === i)
          Ct[0] = i, ee(29, e, 2, Zt[0]);
        else if (Number.isFinite(i)) {
          st(String(i));
          const a = Ze >>> 0;
          ee(29, e, 5 | (He & 16777215) << 8, a);
        } else
          ee(29, e, 0, 0);
      else if (typeof i == "boolean")
        ee(29, e, 3, i ? 1 : 0);
      else if (typeof i == "string")
        Di(e, i, 4) || ee(29, e, 0, 0);
      else if (i !== null && typeof i == "object") {
        let a;
        try {
          a = JSON.stringify(i);
        } catch {
          a = undefined;
        }
        (a === undefined || !Di(e, a, 5)) && ee(29, e, 0, 0);
      } else
        ee(29, e, 0, 0);
    }
  }
  function _t(e, r, n) {
    const i = lt(r), a = an++;
    return zi(a, n), ee(28, e, i, a), xi(e), te(), new Promise((l, c) => {
      pt.set(a, { resolve: l, reject: c });
    });
  }
  function Ca(e, r, n, i, a) {
    const l = lt(r), c = an++;
    zi(c, n), ee(30, e, l, c), xi(e), te(), Ue.set(c, { nodeId: e, onValue: i, onError: a && a.onError, onDone: a && a.onDone });
    let g = Ft.get(e);
    return g === undefined && (g = new Set, Ft.set(e, g)), g.add(c), function() {
      Ue.has(c) && (Ue.delete(c), rn(e, c), ee(31, c, 0, 0), te());
    };
  }
  function Ia(e) {
    const r = Ft.get(e);
    if (r !== undefined) {
      for (const n of r)
        Ue.has(n) && (Ue.delete(n), ee(31, n, 0, 0));
      Ft.delete(e), te();
    }
  }
  var xr = new Map, Li = globalThis.__skalNextHandlerId || 1;
  function kr(e) {
    const r = Li++;
    return xr.set(r, e), r;
  }
  function Tr(e) {
    xr.delete(e);
  }
  function Da(e) {
    tt = e && (e.stack || e.message || String(e)) || "unknown";
    try {
      console.error("skal:", tt);
    } catch {}
  }
  function sn(e, r, n) {
    ee(21, e, r, n);
  }
  var ln = 0n, tt = null, cn = 1310736, za = 1572864, La = 65532, Mi = new ArrayBuffer(4), un = new Float32Array(Mi), fn = new Uint32Array(Mi), Ma = new TextDecoder("utf-8");
  function dn(e, r) {
    return r === 0 ? "" : Ma.decode(Ur.subarray(li + e, li + e + r));
  }
  function hn(e, r) {
    _e[Xo] = e + r;
  }
  function Bi() {
    const e = Atomics.load(qt, Ko);
    if (e === ln)
      return;
    const r = cn + (_e[qo] >> 2);
    let n = cn + (_e[di] >> 2);
    const i = za, a = cn;
    let l = La;
    for (;n !== r && l-- > 0; ) {
      const c = _e[n + 0], g = c & 255, f = c >>> 8 & 255, _ = _e[n + 1], S = _e[n + 2], w = _e[n + 3];
      let P, p = false;
      if (f === 1)
        P = S | 0, p = true;
      else if (f === 2)
        fn[0] = S, P = un[0], p = true;
      else if (f === 3)
        P = S !== 0, p = true;
      else if (f === 4)
        P = dn(w, S), p = true, hn(w, S);
      else if (f === 5) {
        const I = dn(w, S);
        try {
          P = JSON.parse(I);
        } catch {
          P = I;
        }
        p = true, hn(w, S);
      } else if (f === 6) {
        const I = dn(w, S);
        try {
          P = JSON.parse(I);
        } catch {
          P = [];
        }
        p = true, hn(w, S);
      } else if (f === 7) {
        fn[0] = S;
        const I = un[0];
        fn[0] = w, P = [I, un[0]], p = true;
      }
      if (g === 3) {
        const I = pt.get(_);
        if (I) {
          pt.delete(_);
          try {
            I.resolve(p ? P : undefined);
          } catch (R) {
            tt = R && (R.stack || R.message || String(R)) || "unknown";
          }
        }
      } else if (g === 4) {
        const I = pt.get(_);
        if (I) {
          pt.delete(_);
          try {
            const R = typeof P == "string" ? P : `skal RPC error (status ${P})`;
            I.reject(new Error(R));
          } catch (R) {
            tt = R && (R.stack || R.message || String(R)) || "unknown";
          }
        }
      } else if (g === 5) {
        const I = Ue.get(_);
        if (I)
          try {
            I.onValue(p ? P : undefined);
          } catch (R) {
            tt = R && (R.stack || R.message || String(R)) || "unknown";
          }
      } else if (g === 6) {
        const I = Ue.get(_);
        if (I) {
          Ue.delete(_), rn(I.nodeId, _);
          try {
            I.onDone && I.onDone();
          } catch (R) {
            tt = R && (R.stack || R.message || String(R)) || "unknown";
          }
        }
      } else if (g === 7) {
        const I = Ue.get(_);
        if (I) {
          Ue.delete(_), rn(I.nodeId, _);
          try {
            I.onError && I.onError(new Error(typeof P == "string" ? P : "skal stream error"));
          } catch (R) {
            tt = R && (R.stack || R.message || String(R)) || "unknown";
          }
        }
      } else {
        const I = xr.get(_);
        if (I)
          try {
            p ? (f === 6 || f === 7) && Array.isArray(P) ? I(...P) : I(P) : I();
          } catch (R) {
            tt = R && (R.stack || R.message || String(R)) || "unknown";
          }
      }
      n += 4, n >= i && (n = a);
    }
    _e[di] = n - a << 2, ln = e;
  }
  if (vr && typeof window > "u" && !globalThis.__skalRelease) {
    const e = Go();
    e.setDrain(Bi), e.configure({ cleanup() {
      globalThis.__skalNextCallId = an, globalThis.__skalNextHandlerId = Li;
      for (const r of pt.values())
        try {
          r.reject(new Error("skal: hot reload"));
        } catch {}
      pt.clear();
    } });
  } else
    globalThis.__skal_drainEvents = Bi;
  globalThis.skalStatus = () => JSON.stringify({ handlerCount: xr.size, opSeq: Number(Kt), lastEventSeq: Number(ln), lastHandlerError: tt, propWrites: Ae, propSkips: et });
  var bd = 1, Ba = 2;
  function Ni() {
    return Ba++;
  }
  var Na = { box: 0, column: 1, scrollView: 5, listView: 6, reorderableListView: 7, row: 2, text: 3, button: 4, image: 9, stack: 10, switch: 11, slider: 12, checkbox: 13, activityIndicator: 14, progressBar: 15, lazyGrid: 16, wrap: 17, safeArea: 18, richText: 19, textInput: 20, navigator: 21, screen: 22, tabs: 23, tab: 24, animatedList: 25, crossFade: 26, hero: 27, listTile: 28, pageView: 29, dismissible: 30, customScrollView: 31, sliverAppBar: 32, sliverList: 33, sliverGrid: 34, canvas: 35, dragItem: 36, dropZone: 37, radio: 38, chip: 39, segmentedButton: 40, expansionTile: 41, dropdown: 42, stepper: 43, step: 44, drawer: 45, bottomSheet: 46, backdropFilter: 47, interactiveViewer: 48, htmlEmbed: 49 };
  function Wa() {
    const e = [], r = { _cmds: e, fillStyle(n) {
      return e.push(["fillStyle", gn(n)]), r;
    }, strokeStyle(n) {
      return e.push(["strokeStyle", gn(n)]), r;
    }, lineWidth(n) {
      return e.push(["lineWidth", +n || 0]), r;
    }, fillRect(n, i, a, l) {
      return e.push(["fillRect", +n, +i, +a, +l]), r;
    }, strokeRect(n, i, a, l) {
      return e.push(["strokeRect", +n, +i, +a, +l]), r;
    }, circle(n, i, a) {
      return e.push(["circle", +n, +i, +a]), r;
    }, line(n, i, a, l) {
      return e.push(["line", +n, +i, +a, +l]), r;
    }, beginPath() {
      return e.push(["beginPath"]), r;
    }, moveTo(n, i) {
      return e.push(["moveTo", +n, +i]), r;
    }, lineTo(n, i) {
      return e.push(["lineTo", +n, +i]), r;
    }, closePath() {
      return e.push(["closePath"]), r;
    }, fill() {
      return e.push(["fill"]), r;
    }, stroke() {
      return e.push(["stroke"]), r;
    }, fontSize(n) {
      return e.push(["fontSize", +n || 14]), r;
    }, fillText(n, i, a) {
      return e.push(["fillText", String(n), +i, +a]), r;
    } };
    return r;
  }
  var Ha = { padding: [0, "u32"], paddingTop: [1, "u32"], paddingRight: [2, "u32"], paddingBottom: [3, "u32"], paddingLeft: [4, "u32"], width: [5, "dim"], height: [6, "dim"], weight: [7, "f32"], alignment: [8, "u32"], gap: [9, "u32"], axis: [10, "u32"], top: [11, "u32"], right: [12, "u32"], bottom: [13, "u32"], left: [14, "u32"], crossAxisCount: [15, "u32"], aspectRatio: [16, "f32"], background: [32, "color"], color: [33, "color"], cornerRadius: [34, "u32"], borderWidth: [35, "u32"], borderColor: [36, "color"], shadow: [37, "u32"], fontSize: [64, "u32"], fontWeight: [65, "u32"], fontFamily: [66, "u32"], textAlign: [67, "u32"], lineHeight: [68, "u32"], maxLines: [69, "u32"], textOverflow: [70, "u32"], src: [96, "str"], contentScale: [97, "u32"], placeholder: [128, "str"], value: [129, "str"], keyboardType: [130, "u32"], secureEntry: [131, "u32"], checked: [132, "u32"], min: [134, "f32"], max: [135, "f32"], progress: [136, "f32"], initialSize: [176, "f32"], minSize: [177, "f32"], maxSize: [178, "f32"], presentation: [166, "u32"], title: [71, "str"], icon: [98, "str"], leadingIcon: [98, "str"], subtitle: [73, "str"], trailingIcon: [99, "str"], activeTab: [137, "u32"], tag: [72, "str"], transition: [171, "u32"], enabled: [160, "u32"], focusable: [161, "u32"], visible: [162, "u32"], draggable: [172, "u32"], spring: [173, "u32"], release: [174, "u32"], sliverMode: [175, "u32"], dragData: [74, "str"], scrollbar: [179, "u32"], blurRadius: [180, "u32"], minScale: [181, "f32"], maxScale: [182, "f32"], viewType: [183, "str"], semanticLabel: [75, "str"], testID: [76, "str"] }, Va = { opacity: ha, translationX: ga, translationY: pa, scaleX: _a, scaleY: ba, rotation: va }, Ua = { opacity: 1, translationX: 0, translationY: 0, scaleX: 1, scaleY: 1, rotation: 0 }, Ga = { onClick: 1, onclick: 1, onTap: 1, onLongPress: 8, onDoubleTap: 9, onChange: 2, onSubmit: 10, onReorder: 11, onPop: 12, onDismiss: 20, onPanStart: 13, onPanUpdate: 14, onPanEnd: 15, onScaleStart: 16, onScaleUpdate: 17, onScaleEnd: 18, onDrop: 21, onHover: 22, onKey: 23 }, ja = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, qa = { gentle: 1, bouncy: 2, stiff: 3 };
  function gn(e) {
    if (typeof e == "number")
      return e | 0;
    if (typeof e != "string")
      return 0;
    let r = e.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, i = 0, a = 0, l = 255;
    return r.length === 3 ? (n = parseInt(r[0] + r[0], 16), i = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16)) : r.length === 4 ? (n = parseInt(r[0] + r[0], 16), i = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16), l = parseInt(r[3] + r[3], 16)) : r.length === 6 ? (n = parseInt(r.slice(0, 2), 16), i = parseInt(r.slice(2, 4), 16), a = parseInt(r.slice(4, 6), 16)) : r.length === 8 && (l = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), i = parseInt(r.slice(4, 6), 16), a = parseInt(r.slice(6, 8), 16)), (l & 255) << 24 | (n & 255) << 16 | (i & 255) << 8 | a & 255 | 0;
  }
  function Xa(e) {
    return typeof e == "number" ? e | 0 : e === "fill" ? Yo : e === "wrap" ? Jo : -1;
  }
  function Ka(e) {
    if (Array.isArray(e))
      return true;
    const r = Object.getPrototypeOf(e);
    return r === Object.prototype || r === null;
  }
  function Ya(e, r) {
    return e === "number" ? "num" : e === "boolean" ? "bool" : e === "string" ? "str" : e === "object" ? "json" : null;
  }
  function Ja(e, r, n) {
    if (n == null)
      return;
    if (r === "ref" && n && typeof n.__skalBind == "function") {
      n.__skalBind(e.id);
      return;
    }
    const i = typeof n, a = Ya(i, n);
    if (a !== null) {
      const l = e._skalPropKinds || (e._skalPropKinds = {}), c = l[r];
      c !== undefined && c !== a && Oa(e.id, r), l[r] = a;
    }
    if (i === "object" && Ka(n)) {
      Ii(e.id, r, JSON.stringify(n)), te();
      return;
    }
    if (i === "function") {
      if (es(e.tag, r)) {
        e._skalRowCount = 2147483647, e._skalRowOverscan = 0, Vi(e, n);
        return;
      }
      const l = kr(n);
      Fa(e.id, r, l), Vt() && ht(() => Tr(l)), te();
      return;
    }
    if (i === "number") {
      Number.isInteger(n) && n >= 0 && n <= 4294967295 && Oi(e.id, r, n | 0), Fi(e.id, r, n), te();
      return;
    }
    if (i === "string") {
      Ii(e.id, r, n), te();
      return;
    }
    if (i === "boolean") {
      Oi(e.id, r, n ? 1 : 0), te();
      return;
    }
  }
  function pn(e) {
    const r = [e];
    for (;r.length > 0; ) {
      const n = r.pop();
      ua(n.id);
      let i = n.firstChild;
      for (;i; )
        r.push(i), i = i.nextSibling;
    }
  }
  var Za = 8, Wi = 300, _n = new Set, Hi = false;
  function Qa() {
    const e = globalThis.__SKAL_BUILDER_PROPS__;
    if (!(!e || typeof e != "object")) {
      Hi = true;
      for (const r of Object.keys(e)) {
        const n = e[r];
        if (Array.isArray(n))
          for (const i of n)
            _n.add(`${r}:${i}`);
      }
    }
  }
  function es(e, r) {
    return Hi || Qa(), _n.size === 0 ? false : _n.has(`${e}:${r}`);
  }
  function Vi(e, r) {
    const n = e._skalRenderItem && e._skalRenderItem !== r;
    if (e._skalRenderItem = r, e._skalRows) {
      n && ns(e);
      return;
    }
    e._skalRows = new Map;
    const i = kr((...a) => rs(e, a));
    e._skalRowHandlerId = i, sn(e.id, 24, i), Vt() && ht(() => Ui(e)), te();
  }
  function ts(e, r) {
    const n = e._skalRows;
    nt((i) => {
      const a = s("box");
      B(a, () => {
        try {
          return e._skalRenderItem(r);
        } catch (l) {
          return Da(l), null;
        }
      }), xa(e.id, r, a.id), n.set(r, { el: a, dispose: i });
    });
  }
  function rs(e, r) {
    const n = e._skalRows, i = e._skalRowCount | 0;
    if (!e._skalRenderItem || !n || i <= 0 || !r.length)
      return;
    let a = 1 / 0, l = -1 / 0;
    const c = new Set;
    for (const _ of r) {
      const S = _ | 0;
      if (S < 0 || S >= i)
        continue;
      S < a && (a = S), S > l && (l = S);
      const w = e._skalRowOverscan ?? Za, P = Math.max(0, S - w), p = Math.min(i - 1, S + w);
      for (let I = P;I <= p; I++)
        c.add(I);
    }
    if (l < 0)
      return;
    for (const _ of c)
      n.has(_) || ts(e, _);
    const g = a - Wi, f = l + Wi;
    for (const [_, S] of n)
      _ >= g && _ <= f && _ < i || (n.delete(_), bn(e, _, S));
    te();
  }
  function bn(e, r, n) {
    ka(e.id, r), pn(n.el);
    try {
      n.dispose();
    } catch {}
  }
  function ns(e) {
    const r = e._skalRows;
    if (r) {
      for (const [n, i] of r)
        bn(e, n, i);
      r.clear(), te();
    }
  }
  function Ui(e) {
    const r = e._skalRows;
    if (r) {
      e._skalRows = null, e._skalRenderItem = null, e._skalRowHandlerId && (Tr(e._skalRowHandlerId), e._skalRowHandlerId = 0);
      for (const n of r.values()) {
        pn(n.el);
        try {
          n.dispose();
        } catch {}
      }
      r.clear();
    }
  }
  var Er = class {
    constructor(e, r, n = false, i = false) {
      this.tag = e, this.id = r, this.isText = n, this.isCustom = i, this.parent = null, this.firstChild = null, this.lastChild = null, this.nextSibling = null, this.prevSibling = null, this.text = "";
    }
  }, is = ai({ createElement(e) {
    const r = Ni(), n = Na[e];
    return n !== undefined ? (ee(1, r, n, 0), te(), new Er(e, r, false, false)) : (Aa(r, e), te(), new Er(e, r, false, true));
  }, createTextNode(e) {
    const r = Ni();
    ee(1, r, 3, 0);
    const n = e == null ? "" : String(e);
    n.length > 0 && wr(r, n), te();
    const i = new Er("#text", r, true);
    return i.text = n, i;
  }, replaceText(e, r) {
    const n = r == null ? "" : String(r);
    e.text !== n && (e.text = n, wr(e.id, n), te());
  }, setProperty(e, r, n, i) {
    if (e.isCustom) {
      Ja(e, r, n);
      return;
    }
    if (r === "onRefresh") {
      if (typeof n == "function") {
        const g = e.id, f = n, S = kr(async () => {
          try {
            await f();
          } finally {
            ya(g);
          }
        });
        sn(e.id, 19, S), Vt() && ht(() => Tr(S)), te();
      }
      return;
    }
    if (r === "renderItem" && e.tag === "listView") {
      typeof n == "function" && Vi(e, n);
      return;
    }
    if (r === "count" && e.tag === "listView") {
      const g = Math.max(0, n | 0), f = e._skalRowCount | 0;
      e._skalRowCount = g, we(e.id, 17, g);
      const _ = e._skalRows;
      if (_ && g < f)
        for (const [S, w] of _)
          S < g || (_.delete(S), bn(e, S, w));
      te();
      return;
    }
    if (r === "draw" && typeof n == "function") {
      const g = n, f = e;
      Rt(() => {
        const _ = Wa();
        try {
          g(_);
        } catch {}
        const S = JSON.stringify(_._cmds);
        S !== f._skalCanvasProgram && (f._skalCanvasProgram = S, wr(f.id, S), te());
      });
      return;
    }
    const a = Ga[r];
    if (a !== undefined) {
      if (typeof n == "function") {
        const g = kr(n);
        sn(e.id, a, g), Vt() && ht(() => Tr(g)), te();
      }
      return;
    }
    if (r === "value" && e.tag === "slider") {
      Ri(e.id, 133, Number(n) || 0), te();
      return;
    }
    if (r === "draggable" && typeof n == "string") {
      we(e.id, 172, { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }[n] ?? 0), te();
      return;
    }
    if (r === "spring" && typeof n == "string") {
      we(e.id, 173, { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }[n] ?? 0), te();
      return;
    }
    if (r === "release" && typeof n == "string") {
      we(e.id, 174, { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }[n.toLowerCase()] ?? 0), te();
      return;
    }
    if (r === "sliverMode" && typeof n == "string") {
      we(e.id, 175, { normal: 0, pinned: 1, floating: 2, both: 3 }[n.toLowerCase()] ?? 0), te();
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      if (we(e.id, 163, n.duration | 0), n.curve != null) {
        const g = typeof n.curve == "string" ? ja[n.curve] ?? 0 : n.curve | 0;
        we(e.id, 164, g);
      }
      if (n.delay != null && we(e.id, 165, n.delay | 0), n.repeat != null && we(e.id, 167, n.repeat ? 1 : 0), n.reverse != null && we(e.id, 168, n.reverse ? 1 : 0), n.loop != null && we(e.id, 169, n.loop | 0), n.spring != null) {
        const g = typeof n.spring == "string" ? qa[n.spring] ?? 0 : n.spring ? 2 : 0;
        we(e.id, 170, g);
      }
      te();
      return;
    }
    if (r === "label" && (e.tag === "button" || e.tag === "text" || e.tag === "chip")) {
      const g = n == null ? "" : String(n);
      wr(e.id, g), te();
      return;
    }
    const l = Va[r];
    if (l !== undefined) {
      typeof n == "number" ? (l(e.id, n), te()) : n == null && (l(e.id, Ua[r]), te());
      return;
    }
    const c = Ha[r];
    if (c !== undefined) {
      const [g, f] = c;
      if (n == null) {
        fa(e.id, g), te();
        return;
      }
      switch (f) {
        case "u32":
          typeof n == "number" ? (we(e.id, g, n | 0), te()) : typeof n == "boolean" && (we(e.id, g, n ? 1 : 0), te());
          return;
        case "f32":
          typeof n == "number" && (Ri(e.id, g, n), te());
          return;
        case "str":
          da(e.id, g, String(n)), te();
          return;
        case "color":
          we(e.id, g, gn(n)), te();
          return;
        case "dim":
          we(e.id, g, Xa(n)), te();
          return;
      }
      return;
    }
    if (r === "style" && n && typeof n == "object") {
      for (const g in n)
        this.setProperty(e, g, n[g]);
      return;
    }
  }, insertNode(e, r, n) {
    if (r === n)
      return;
    if (r.parent) {
      const a = r.parent;
      r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : a.firstChild === r && (a.firstChild = r.nextSibling), r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : a.lastChild === r && (a.lastChild = r.prevSibling), r.prevSibling = null, r.nextSibling = null;
    }
    const i = n ? n.id : 0;
    ee(3, e.id, r.id, i), te(), r.parent = e, n ? (r.nextSibling = n, r.prevSibling = n.prevSibling, n.prevSibling ? n.prevSibling.nextSibling = r : e.firstChild = r, n.prevSibling = r) : (r.prevSibling = e.lastChild, r.nextSibling = null, e.lastChild ? e.lastChild.nextSibling = r : e.firstChild = r, e.lastChild = r);
  }, removeNode(e, r) {
    r._skalRows && Ui(r), ee(2, r.id, 0, 0), pn(r), te(), r.prevSibling ? r.prevSibling.nextSibling = r.nextSibling : e.firstChild = r.nextSibling, r.nextSibling ? r.nextSibling.prevSibling = r.prevSibling : e.lastChild = r.prevSibling, r.parent = null, r.prevSibling = null, r.nextSibling = null;
  }, isTextNode(e) {
    return e.isText;
  }, getParentNode(e) {
    return e.parent;
  }, getFirstChild(e) {
    return e.firstChild;
  }, getNextSibling(e) {
    return e.nextSibling;
  } }), { render: vn, effect: G, memo: mn, createComponent: L, createElement: s, createTextNode: vd, insertNode: m, insert: B, spread: md, setProp: t, mergeProps: wd, use: os } = is;
  ee(1, 1, 0, 0), te();
  var wn = new Er("box", 1, false);
  globalThis.__skalHot && globalThis.__skalHot.configure({ render: (e) => vn(e, wn), reset: () => oa() });
  var Gi = "/flutter-web-plugins", Dt = null;
  async function ji() {
    return Dt || (globalThis.__skalPluginCall ? (Dt = Promise.resolve(), Dt) : (Dt = as(), Dt));
  }
  async function as() {
    if (typeof document > "u")
      throw new Error("Skal plugin bridge: ensurePluginHost called with no DOM (SSR? worker?). The hidden Flutter Web host needs a real DOM to mount into.");
    const e = document.createElement("div");
    e.id = "skal-plugin-host", e.setAttribute("aria-hidden", "true"), e.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;left:-9999px;top:-9999px;pointer-events:none;contain:strict;overflow:hidden", document.body.appendChild(e), globalThis.__skalPluginHostMount = e;
    const r = new Promise((a) => {
      if (globalThis.__skalPluginCall)
        return a();
      const l = () => {
        window.removeEventListener("skal-plugin-host-ready", l), a();
      };
      window.addEventListener("skal-plugin-host-ready", l, { once: true });
    }), n = document.createElement("script");
    n.src = `${Gi}/flutter_bootstrap.js`, n.async = true;
    const i = new Promise((a, l) => {
      n.onerror = () => l(new Error(`Skal plugin bridge: failed to load ${n.src}. Did you build the plugin host (\`bun run build:flutter-plugins\`) and is the vite middleware (Phase 3) serving ${Gi}/*?`));
    });
    if (document.head.appendChild(n), await Promise.race([r, i]), typeof globalThis.__skalPluginCall != "function")
      throw new Error(`Skal plugin bridge: host signaled ready but __skalPluginCall is not a function (got ${typeof globalThis.__skalPluginCall}).`);
  }
  var Sn = Promise.resolve();
  async function ss(e) {
    await ji();
    const r = globalThis.__skalFlutterApp;
    if (!r || typeof r.addView != "function")
      throw new Error("Skal plugin bridge: addView not available. Multi-view requires Flutter Web 3.10+ with multiViewEnabled:true in the bootstrap config.");
    return Sn = Sn.catch(() => {}).then(async () => {
      const n = await r.addView({ hostElement: e });
      return await new Promise((i) => requestAnimationFrame(i)), n;
    }), Sn;
  }
  async function ls(e) {
    const r = globalThis.__skalFlutterApp;
    !r || typeof r.removeView != "function" || await r.removeView(e);
  }
  async function yn(e, r) {
    await ji();
    const n = JSON.stringify(r ?? {}), i = await globalThis.__skalPluginCall(e, n);
    let a;
    try {
      a = JSON.parse(i);
    } catch {
      throw new Error(`Skal plugin bridge: host returned non-JSON for "${e}": ${i}`);
    }
    if (!a || typeof a != "object")
      throw new Error(`Skal plugin bridge: host returned non-envelope for "${e}": ${i}`);
    if (a.ok === true)
      return a.value;
    const l = new Error(a.error || `Skal plugin "${e}" failed`);
    throw a.stack && (l.stack = a.stack), l;
  }
  var cs = { column: "div", scrollView: "div", listView: "div", reorderableListView: "div", row: "div", box: "div", text: "span", button: "button", image: "img", stack: "div", switch: "input", slider: "input", checkbox: "input", activityIndicator: "div", progressBar: "progress", lazyGrid: "div", wrap: "div", safeArea: "div", richText: "span", textInput: "input", navigator: "div", screen: "div", tabs: "div", tab: "div", animatedList: "div", crossFade: "div", hero: "div", listTile: "div", pageView: "div", dismissible: "div", flutterEmbed: "div", customScrollView: "div", sliverAppBar: "div", sliverList: "div", sliverGrid: "div", canvas: "canvas", dragItem: "div", dropZone: "div", radio: "input", chip: "div", segmentedButton: "div", expansionTile: "div", dropdown: "select", stepper: "div", step: "div", drawer: "aside", bottomSheet: "div", backdropFilter: "div", interactiveViewer: "div" };
  if (typeof document < "u" && !document.getElementById("skal-kf")) {
    const e = document.createElement("style");
    e.id = "skal-kf", e.textContent = "@keyframes skal-spin{to{transform:rotate(360deg)}}", document.head.appendChild(e);
  }
  var us = { grid: "\u25A6", list: "\u2630", explore: "\u29BF", code: "\u27E8\u27E9", storage: "\u2630", home: "\u2302", settings: "\u2699", search: "\uD83D\uDD0D", user: "\u263B", heart: "\u2661", star: "\u2605", plus: "+" }, fs = "#0A84FF", ds = "#8E8E93", hs = "#F2F2F7", gs = "#E5E5EA";
  function ps(e) {
    const r = [];
    for (const n of e.children)
      n._skalTag === "tab" && r.push(n);
    return r;
  }
  function _s(e) {
    let r = e._skalBar;
    return r && r.parentElement === e || (r = document.createElement("div"), r.setAttribute("role", "tablist"), r.style.cssText = `display:flex;flex-direction:row;align-items:stretch;flex:0 0 auto;border-top:1px solid ${gs};background:${hs};padding:6px 4px;padding-bottom:calc(6px + env(safe-area-inset-bottom, 0px));min-height:50px;gap:4px;user-select:none;box-sizing:border-box;`, e.appendChild(r), e._skalBar = r), r;
  }
  function bs(e) {
    return new Promise((r) => {
      if (e.offsetWidth > 0 && e.offsetHeight > 0) {
        r();
        return;
      }
      if (typeof ResizeObserver > "u") {
        requestAnimationFrame(() => r());
        return;
      }
      const n = new ResizeObserver((i) => {
        for (const a of i) {
          const l = a.contentRect;
          if (l.width > 0 && l.height > 0) {
            n.disconnect(), r();
            return;
          }
        }
      });
      n.observe(e);
    });
  }
  async function vs(e) {
    return e._skalViewPromise || (e._skalViewPromise = (async () => {
      if (await bs(e), e._skalEmbedRemoved)
        throw new Error("Skal <flutterEmbed>: removed before view could be added");
      const r = await ss(e);
      return typeof window < "u" && requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      }), r;
    })()), e._skalViewPromise;
  }
  function xn(e) {
    e._skalSyncScheduled || (e._skalSyncScheduled = true, queueMicrotask(async () => {
      e._skalSyncScheduled = false;
      const r = e._skalEmbedWidget;
      if (r)
        try {
          const n = await vs(e);
          if (e._skalEmbedRemoved)
            return;
          await yn("embed.setSpec", { viewId: n, widget: r, props: e._skalEmbedProps || {} });
        } catch (n) {
          console.error(`Skal <flutterEmbed widget="${r}"> failed:`, n);
        }
    }));
  }
  async function ms(e) {
    if (e._skalEmbedRemoved = true, !!e._skalViewPromise)
      try {
        const r = await e._skalViewPromise;
        try {
          await yn("embed.unsetSpec", { viewId: r });
        } catch {}
        await ls(r);
      } catch (r) {
        console.warn("Skal <flutterEmbed> teardown failed:", r);
      }
  }
  function Rr(e) {
    e._skalTabsRenderScheduled || (e._skalTabsRenderScheduled = true, queueMicrotask(() => {
      e._skalTabsRenderScheduled = false, ws(e);
    }));
  }
  function ws(e) {
    const r = ps(e), n = e._skalActiveTab | 0, i = r.length === 0 ? 0 : Math.min(Math.max(n, 0), r.length - 1);
    for (let l = 0;l < r.length; l++) {
      const c = r[l];
      l === i ? (c.style.display = "flex", c.style.flexDirection = "column", c.style.flex = "1 1 auto", c.style.minHeight = "0", c.style.overflow = "auto") : c.style.display = "none";
    }
    const a = _s(e);
    a.innerHTML = "";
    for (let l = 0;l < r.length; l++) {
      const c = r[l], g = l === i, f = document.createElement("button");
      f.type = "button", f.setAttribute("role", "tab"), f.setAttribute("aria-selected", g ? "true" : "false"), f.style.cssText = "flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:transparent;border:0;cursor:pointer;font:inherit;padding:4px 2px;gap:2px;line-height:1.15;font-size:11px;color:" + (g ? fs : ds) + ";";
      const _ = c._skalIcon;
      if (_) {
        const w = document.createElement("span");
        w.textContent = us[_] || "\u25CF", w.style.cssText = "font-size:20px;line-height:1;", f.appendChild(w);
      }
      const S = c._skalTitle;
      if (S) {
        const w = document.createElement("span");
        w.textContent = S, f.appendChild(w);
      }
      f.onclick = () => {
        const w = e._skalOnChange;
        typeof w == "function" && w(l);
      }, a.appendChild(f);
    }
  }
  function Ss(e, r) {
    const n = e.style;
    switch (r) {
      case "column":
        n.display = "flex", n.flexDirection = "column", n.alignItems = "flex-start", n.boxSizing = "border-box", n.width = "100%", n.padding = "16px", n.gap = "8px";
        break;
      case "scrollView":
      case "listView":
      case "reorderableListView":
        n.display = "flex", n.flexDirection = "column", n.alignItems = "flex-start", n.boxSizing = "border-box", n.width = "100%", n.height = "100%", n.overflowY = "auto", n.padding = "16px", n.gap = "8px", n.webkitOverflowScrolling = "touch";
        break;
      case "row":
        n.display = "flex", n.flexDirection = "row", n.boxSizing = "border-box";
        break;
      case "listTile":
        n.display = "flex", n.flexDirection = "row", n.alignItems = "center", n.boxSizing = "border-box", n.width = "100%", n.minHeight = "56px", n.padding = "8px 16px", n.gap = "16px";
        break;
      case "pageView":
        n.display = "flex", n.flexDirection = "row", n.boxSizing = "border-box", n.width = "100%", n.height = "100%", n.overflowX = "auto", n.scrollSnapType = "x mandatory", n.scrollbarWidth = "none", n.msOverflowStyle = "none";
        break;
      case "customScrollView":
        n.display = "flex", n.flexDirection = "column", n.boxSizing = "border-box", n.width = "100%", n.height = "100%", n.overflowY = "auto", n.webkitOverflowScrolling = "touch";
        break;
      case "sliverAppBar":
        n.position = "sticky", n.top = "0", n.zIndex = "1", n.boxSizing = "border-box", n.width = "100%";
        break;
      case "sliverList":
        n.display = "flex", n.flexDirection = "column", n.boxSizing = "border-box", n.width = "100%";
        break;
      case "sliverGrid":
        n.display = "grid", n.boxSizing = "border-box", n.width = "100%";
        break;
      case "box":
        n.display = "block", n.position = "relative", n.boxSizing = "border-box";
        break;
      case "stack":
        n.display = "block", n.position = "relative", n.boxSizing = "border-box";
        break;
      case "switch":
      case "checkbox":
        e.type = "checkbox";
        break;
      case "slider":
        e.type = "range", e.min = "0", e.max = "1", e.step = "any", n.width = "100%";
        break;
      case "activityIndicator":
        n.width = "24px", n.height = "24px", n.boxSizing = "border-box", n.border = "3px solid rgba(0,0,0,0.15)", n.borderTopColor = "rgba(0,0,0,0.55)", n.borderRadius = "50%", n.animation = "skal-spin 0.8s linear infinite";
        break;
      case "progressBar":
        n.width = "100%";
        break;
      case "text":
        n.fontFamily = 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace', n.whiteSpace = "pre-line";
        break;
      case "button":
        n.display = "inline-flex", n.alignItems = "center", n.justifyContent = "center", n.padding = "8px 24px", n.background = "#6750A4", n.color = "#FFFFFF", n.border = "none", n.borderRadius = "20px", n.fontSize = "14px", n.fontWeight = "500", n.cursor = "pointer", n.fontFamily = "inherit", n.boxSizing = "border-box";
        break;
      case "image":
        n.display = "block", n.objectFit = "contain";
        break;
      case "lazyGrid":
        n.display = "grid", n.gridTemplateColumns = "repeat(2, 1fr)", n.gap = "8px", n.boxSizing = "border-box", n.width = "100%", n.padding = "16px", n.overflowY = "auto";
        break;
      case "wrap":
        n.display = "flex", n.flexWrap = "wrap", n.gap = "8px", n.boxSizing = "border-box";
        break;
      case "safeArea":
        n.display = "block", n.boxSizing = "border-box", n.paddingTop = "env(safe-area-inset-top)", n.paddingBottom = "env(safe-area-inset-bottom)", n.paddingLeft = "env(safe-area-inset-left)", n.paddingRight = "env(safe-area-inset-right)";
        break;
      case "richText":
        n.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif', n.whiteSpace = "pre-line";
        break;
      case "textInput":
        e.type = "text", n.boxSizing = "border-box", n.padding = "8px 12px", n.border = "1px solid rgba(0,0,0,0.4)", n.borderRadius = "4px", n.fontSize = "14px", n.fontFamily = "inherit";
        break;
      case "navigator":
        n.position = "relative", n.overflow = "hidden", n.boxSizing = "border-box", n.width = "100%", n.height = "100%", n.flex = "1 1 auto", n.minHeight = "0";
        break;
      case "screen":
        n.position = "absolute", n.inset = "0", n.overflow = "auto", n.boxSizing = "border-box", n.background = "#FFFFFF";
        break;
      case "tabs":
        n.display = "flex", n.flexDirection = "column", n.boxSizing = "border-box", n.height = "100%", n.minHeight = "0", n.overflow = "hidden";
        break;
      case "tab":
        n.display = "block", n.boxSizing = "border-box";
        break;
      case "flutterEmbed":
        n.display = "block", n.boxSizing = "border-box", n.position = "relative", n.width = "100%", n.alignSelf = "stretch", n.overflow = "hidden";
        break;
    }
  }
  var ys = ["contain", "cover", "fill", "contain", "contain", "none", "scale-down"];
  function kn(e) {
    if (e == null)
      return null;
    if (typeof e == "number") {
      const c = e >>> 24 & 255;
      return `rgba(${e >>> 16 & 255}, ${e >>> 8 & 255}, ${e & 255}, ${(c / 255).toFixed(3)})`;
    }
    if (typeof e != "string")
      return null;
    let r = e.trim();
    r.startsWith("#") && (r = r.slice(1));
    let n = 0, i = 0, a = 0, l = 255;
    if (r.length === 3)
      n = parseInt(r[0] + r[0], 16), i = parseInt(r[1] + r[1], 16), a = parseInt(r[2] + r[2], 16);
    else if (r.length === 6)
      n = parseInt(r.slice(0, 2), 16), i = parseInt(r.slice(2, 4), 16), a = parseInt(r.slice(4, 6), 16);
    else if (r.length === 8)
      l = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), i = parseInt(r.slice(4, 6), 16), a = parseInt(r.slice(6, 8), 16);
    else
      return e;
    return `rgba(${n}, ${i}, ${a}, ${(l / 255).toFixed(3)})`;
  }
  function qi(e) {
    return typeof e == "number" ? `${e}px` : e === "fill" ? "100%" : e === "wrap" ? "auto" : typeof e == "string" ? e : null;
  }
  var Xi = { 0: 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif', 1: '"Times New Roman", Times, serif', 2: 'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace', 3: 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, sans-serif' }, xs = { linear: 0, easeIn: 1, easeOut: 2, easeInOut: 3, bounce: 4, elastic: 5, fastOutSlowIn: 6 }, ks = ["linear", "ease-in", "ease-out", "ease-in-out", "cubic-bezier(.4,0,.2,1)", "cubic-bezier(.4,0,.2,1)", "cubic-bezier(.4,0,.2,1)"], Ts = ["start", "center", "end", "justify"], Es = ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"];
  function ct(e) {
    return e._skalHot || (e._skalHot = { tx: 0, ty: 0, sx: 1, sy: 1, rz: 0 }, e.style.willChange = "transform, opacity"), e._skalHot;
  }
  function Ge(e) {
    const r = e._skalHot;
    if (r) {
      if (r.tx === 0 && r.ty === 0 && r.sx === 1 && r.sy === 1 && r.rz === 0) {
        e.style.transform = "", e.style.willChange = "", e._skalHot = null;
        return;
      }
      e.style.transform = `translate(${r.tx}px, ${r.ty}px) scale(${r.sx}, ${r.sy}) rotate(${r.rz}deg)`;
    }
  }
  function Tn(e) {
    if (e._skalGAttached)
      return;
    e._skalGAttached = true, e.style.touchAction = "none";
    const r = new Map;
    let n = -1, i = 0, a = 0, l = 0, c = 0, g = 0, f = 1, _ = 0, S = false;
    e.addEventListener("pointerdown", (P) => {
      const p = e._skalG;
      if (!p)
        return;
      r.set(P.pointerId, { x: P.clientX, y: P.clientY });
      const I = p.scaleStart || p.scaleUpdate || p.scaleEnd;
      if (r.size === 2 && I) {
        const [F, z] = [...r.values()];
        f = Math.hypot(F.x - z.x, F.y - z.y) || 1, _ = Math.atan2(z.y - F.y, z.x - F.x), S = true, p.scaleStart && p.scaleStart();
        return;
      }
      const R = p.panStart || p.panUpdate || p.panEnd || p.draggable;
      if (n === -1 && R && !I) {
        e._skalReleaseCancel && (e._skalReleaseCancel(), e._skalReleaseCancel = null), n = P.pointerId, e.setPointerCapture(P.pointerId);
        const F = e.getBoundingClientRect();
        i = P.clientX, a = P.clientY, l = P.timeStamp, c = 0, g = 0, p.panStart && p.panStart(P.clientX - F.left, P.clientY - F.top);
      }
    }), e.addEventListener("pointermove", (P) => {
      const p = e._skalG;
      if (!p)
        return;
      if (r.has(P.pointerId) && r.set(P.pointerId, { x: P.clientX, y: P.clientY }), S && r.size >= 2) {
        const [z, E] = [...r.values()], A = Math.hypot(z.x - E.x, z.y - E.y), h = Math.atan2(E.y - z.y, E.x - z.x) - _;
        p.scaleUpdate && p.scaleUpdate(A / f, h);
        return;
      }
      if (P.pointerId !== n)
        return;
      const I = P.clientX - i, R = P.clientY - a, F = Math.max(1, P.timeStamp - l);
      if (c = I / F * 1000, g = R / F * 1000, i = P.clientX, a = P.clientY, l = P.timeStamp, p.draggable) {
        const z = ct(e);
        p.draggable !== 3 && (z.tx += I), p.draggable !== 2 && (z.ty += R), Ge(e);
      } else
        p.panUpdate && p.panUpdate(I, R);
    });
    const w = (P) => {
      const p = e._skalG;
      if (r.delete(P.pointerId), S && r.size < 2 && (S = false, p && p.scaleEnd && p.scaleEnd()), P.pointerId === n && (n = -1, !!p)) {
        if (p.draggable && p.release)
          Rs(e, p, c, g);
        else if (p.panEnd)
          if (p.draggable) {
            const I = e._skalHot || { tx: 0, ty: 0 };
            p.panEnd(I.tx, I.ty);
          } else
            p.panEnd(c, g);
      }
    };
    e.addEventListener("pointerup", w), e.addEventListener("pointercancel", w);
  }
  function Rs(e, r, n, i) {
    const a = ct(e), l = r.release === 2, c = 2 * Math.sqrt(200) * 0.7;
    r.draggable === 2 && (i = 0), r.draggable === 3 && (n = 0);
    let g = performance.now(), f = 0;
    const _ = (S) => {
      let w = (S - g) / 1000;
      if (g = S, w > 0.05 && (w = 0.05), l) {
        if (n += (-200 * a.tx - c * n) * w, i += (-200 * a.ty - c * i) * w, a.tx += n * w, a.ty += i * w, Math.abs(a.tx) < 0.5 && Math.abs(a.ty) < 0.5 && Math.abs(n) < 5 && Math.abs(i) < 5) {
          a.tx = 0, a.ty = 0, Ge(e), e._skalReleaseCancel = null, r.panEnd && r.panEnd(0, 0);
          return;
        }
      } else {
        const P = Math.exp(-3 * w);
        if (n *= P, i *= P, a.tx += n * w, a.ty += i * w, Math.abs(n) < 5 && Math.abs(i) < 5) {
          Ge(e), e._skalReleaseCancel = null, r.panEnd && r.panEnd(a.tx, a.ty);
          return;
        }
      }
      Ge(e), f = requestAnimationFrame(_);
    };
    e._skalReleaseCancel = () => {
      f && cancelAnimationFrame(f);
    }, f = requestAnimationFrame(_);
  }
  var $s = { onPanStart: "panStart", onPanUpdate: "panUpdate", onPanEnd: "panEnd", onScaleStart: "scaleStart", onScaleUpdate: "scaleUpdate", onScaleEnd: "scaleEnd" }, Ps = { free: 1, both: 1, horizontal: 2, x: 2, vertical: 3, y: 3 }, As = { none: 0, glide: 1, friction: 1, springback: 2, spring: 2 }, Os = { gentle: 1, bouncy: 2, stiff: 3, wobbly: 2 }, ae = (...e) => (r, n) => {
    for (let i = 0;i < e.length; i++)
      n[e[i]] = "";
  }, Qt = (e, r) => (n) => {
    ct(n)[e] = r, Ge(n);
  }, Fs = { padding: ae("padding"), paddingTop: ae("paddingTop"), paddingRight: ae("paddingRight"), paddingBottom: ae("paddingBottom"), paddingLeft: ae("paddingLeft"), width: ae("width"), height: ae("height"), weight: ae("flexGrow"), gap: ae("gap"), alignment: ae("justifyContent"), axis: (e, r) => {
    e._skalListAxis = 0, r.flexDirection = "", r.overflowX = "", r.overflowY = "";
  }, crossAxisCount: ae("gridTemplateColumns"), aspectRatio: () => {}, top: (e, r) => {
    r.top = "", $r(r);
  }, right: (e, r) => {
    r.right = "", $r(r);
  }, bottom: (e, r) => {
    r.bottom = "", $r(r);
  }, left: (e, r) => {
    r.left = "", $r(r);
  }, background: ae("background"), color: ae("color"), cornerRadius: ae("borderRadius"), borderWidth: (e, r) => {
    r.borderWidth = "", r.borderColor || (r.borderStyle = "");
  }, borderColor: (e, r) => {
    r.borderColor = "", r.borderWidth || (r.borderStyle = "");
  }, shadow: ae("boxShadow"), fontSize: ae("fontSize"), fontWeight: ae("fontWeight"), fontFamily: ae("fontFamily"), textAlign: ae("textAlign"), lineHeight: ae("lineHeight"), maxLines: ae("display", "webkitLineClamp", "webkitBoxOrient", "overflow"), textOverflow: ae("textOverflow", "overflow"), src: (e) => {
    e._skalTag === "image" && e.removeAttribute("src");
  }, contentScale: ae("objectFit"), checked: (e) => {
    e.checked = false;
  }, min: (e) => {
    e.removeAttribute("min");
  }, max: (e) => {
    e.removeAttribute("max");
  }, progress: (e) => {
    e.removeAttribute("value");
  }, placeholder: (e) => {
    e._skalTag !== "button" && (e.placeholder = "");
  }, value: (e) => {
    e._skalTag !== "button" && (e.value = "");
  }, secureEntry: (e) => {
    e._skalTag === "textInput" && (e.type = "text");
  }, keyboardType: (e) => {
    e.inputMode = "text";
  }, enabled: (e) => {
    e.disabled = false;
  }, focusable: (e) => {
    e.removeAttribute("tabindex");
  }, visible: ae("display"), opacity: ae("opacity"), translationX: Qt("tx", 0), translationY: Qt("ty", 0), scaleX: Qt("sx", 1), scaleY: Qt("sy", 1), rotation: Qt("rz", 0) };
  function $r(e) {
    !e.top && !e.right && !e.bottom && !e.left && (e.position = "");
  }
  function Cs(e, r) {
    const n = Fs[r];
    n !== undefined && n(e, e.style);
  }
  function Is(e, r, n) {
    const i = e.style;
    switch (r) {
      case "padding":
        i.padding = `${n}px`;
        return;
      case "paddingTop":
        i.paddingTop = `${n}px`;
        return;
      case "paddingRight":
        i.paddingRight = `${n}px`;
        return;
      case "paddingBottom":
        i.paddingBottom = `${n}px`;
        return;
      case "paddingLeft":
        i.paddingLeft = `${n}px`;
        return;
      case "width": {
        const a = qi(n);
        a != null && (i.width = a);
        return;
      }
      case "height": {
        const a = qi(n);
        a != null && (i.height = a);
        return;
      }
      case "weight":
        i.flexGrow = String(n);
        return;
      case "gap":
        i.gap = `${n}px`;
        return;
      case "alignment": {
        const a = Es[n];
        a && (i.justifyContent = a);
        return;
      }
      case "axis":
        e._skalListAxis = n === 1 ? 1 : 0, n === 1 ? (i.flexDirection = "row", i.overflowX = "auto", i.overflowY = "hidden") : (i.flexDirection = "column", i.overflowX = "hidden", i.overflowY = "auto");
        return;
      case "crossAxisCount":
        i.gridTemplateColumns = `repeat(${n}, 1fr)`;
        return;
      case "aspectRatio":
        return;
      case "top":
        i.position = "absolute", i.top = `${n}px`;
        return;
      case "right":
        i.position = "absolute", i.right = `${n}px`;
        return;
      case "bottom":
        i.position = "absolute", i.bottom = `${n}px`;
        return;
      case "left":
        i.position = "absolute", i.left = `${n}px`;
        return;
      case "background": {
        const a = kn(n);
        a && (i.background = a);
        return;
      }
      case "color": {
        const a = kn(n);
        a && (i.color = a);
        return;
      }
      case "cornerRadius":
        i.borderRadius = `${n}px`;
        return;
      case "borderWidth":
        i.borderWidth = `${n}px`, i.borderStyle = "solid";
        return;
      case "borderColor": {
        const a = kn(n);
        a && (i.borderColor = a);
        return;
      }
      case "shadow":
        i.boxShadow = `0 ${n / 2}px ${n}px rgba(0,0,0,0.2)`;
        return;
      case "fontSize":
        i.fontSize = `${n}px`;
        return;
      case "fontWeight":
        i.fontWeight = String(n);
        return;
      case "fontFamily":
        i.fontFamily = Xi[n] || Xi[0];
        return;
      case "textAlign":
        i.textAlign = Ts[n] || "start";
        return;
      case "lineHeight":
        i.lineHeight = `${n}px`;
        return;
      case "maxLines":
        n && n > 0 && n !== 2147483647 && (i.display = "-webkit-box", i.webkitLineClamp = String(n), i.webkitBoxOrient = "vertical", i.overflow = "hidden");
        return;
      case "textOverflow":
        n === 1 ? i.textOverflow = "ellipsis" : n === 2 ? i.overflow = "visible" : i.textOverflow = "clip";
        return;
      case "src":
        e._skalTag === "image" && (e.src = String(n));
        return;
      case "contentScale":
        i.objectFit = ys[n] || "contain";
        return;
      case "checked":
        e.checked = !!n;
        return;
      case "min":
        e.min = String(n);
        return;
      case "max":
        e.max = String(n);
        return;
      case "progress":
        n < 0 ? e.removeAttribute("value") : e.value = String(n);
        return;
      case "placeholder":
        if (e._skalTag === "button")
          return;
        e.placeholder = String(n);
        return;
      case "value":
        if (e._skalTag === "button")
          return;
        e.value = String(n);
        return;
      case "secureEntry":
        e._skalTag === "textInput" && (e.type = n ? "password" : "text");
        return;
      case "keyboardType":
        e.inputMode = ["text", "numeric", "email", "tel", "url", "text"][n] || "text";
        return;
      case "enabled":
        e.disabled = !n;
        return;
      case "focusable":
        e.tabIndex = n ? 0 : -1;
        return;
      case "visible":
        i.display = n ? "" : "none";
        return;
      case "opacity":
        i.opacity = String(n);
        return;
      case "translationX":
        ct(e).tx = n, Ge(e);
        return;
      case "translationY":
        ct(e).ty = n, Ge(e);
        return;
      case "scaleX":
        ct(e).sx = n, Ge(e);
        return;
      case "scaleY":
        ct(e).sy = n, Ge(e);
        return;
      case "rotation":
        ct(e).rz = n, Ge(e);
        return;
    }
  }
  var Ki = new Set;
  function Ds(e) {
    Ki.has(e) || (Ki.add(e), console.warn(`Skal web: unknown intrinsic <${e}> \u2014 rendering placeholder. Custom widgets / Flutter plugins need the B.5 plugin host (WEB_SUPPORT_PLAN.md Phases 1\u20135).`));
  }
  var Yi = 6, zs = 48, Ls = 20, En = 1500, Ji = false;
  function Zi(e) {
    const r = e._skalRowH;
    return r && r.n > 0 ? r.total / r.n : zs;
  }
  function Ms(e, r) {
    const n = r.offsetHeight;
    if (!n)
      return;
    const i = e._skalRowH || (e._skalRowH = { total: 0, n: 0 });
    i.total += n, i.n += 1;
  }
  function Bs(e, r) {
    const n = e.clientHeight | 0;
    if (n <= 0)
      return { start: 0, end: Math.min(r, Ls) };
    const i = Zi(e), a = Math.max(0, Math.floor((e.scrollTop | 0) / i) - Yi), l = Math.ceil(n / i) + Yi * 2;
    return { start: a, end: Math.min(r, a + l) };
  }
  function Ns(e) {
    if (e._skalWindowArmed)
      return;
    e._skalWindowArmed = true;
    const r = () => Pr(e);
    if (e.addEventListener("scroll", r, { passive: true }), e._skalWindowOff = () => e.removeEventListener("scroll", r), typeof ResizeObserver == "function") {
      const n = new ResizeObserver(() => Pr(e));
      n.observe(e);
      const i = e._skalWindowOff;
      e._skalWindowOff = () => {
        i(), n.disconnect();
      };
    }
  }
  function Qi(e) {
    e._skalBuilderTeardownArmed || (e._skalBuilderTeardownArmed = true, Vt() && ht(() => to(e)));
  }
  function Pr(e) {
    e._skalBuilderSyncQueued || (e._skalBuilderSyncQueued = true, queueMicrotask(() => {
      e._skalBuilderSyncQueued = false, Ws(e);
    }));
  }
  function eo(e, r, n, i) {
    nt((a) => {
      const l = document.createElement("div");
      l._skalBuilderRow = true, l._skalRowIndex = n, Gs(l, () => {
        try {
          return i(n);
        } catch (c) {
          try {
            console.error("skal:", c);
          } catch {}
          return null;
        }
      }), r.set(n, { el: l, dispose: a });
    });
  }
  function Ws(e) {
    const r = e._skalRenderItem;
    if (!r)
      return;
    const n = e._skalRows || (e._skalRows = new Map), i = e._skalRowCount | 0;
    for (let _ = e.firstChild;_; ) {
      const S = _.nextSibling;
      !_._skalBuilderRow && !_._skalSpacer && e.removeChild(_), _ = S;
    }
    if (e._skalListAxis === 1) {
      const _ = Math.min(i, En);
      i > En && !Ji && (Ji = true, console.warn(`skal-web: horizontal builder-mode <ListView> renders eagerly \u2014 capped at ${En} of ${i} rows. Vertical lists are windowed and have no cap.`));
      for (const [S, w] of n)
        if (!(S < _)) {
          n.delete(S);
          try {
            w.el.remove();
          } catch {}
          try {
            w.dispose();
          } catch {}
        }
      for (let S = 0;S < _; S++)
        n.has(S) || (eo(e, n, S, r), e.appendChild(n.get(S).el));
      return;
    }
    Ns(e);
    const { start: a, end: l } = Bs(e, i);
    for (const [_, S] of n)
      if (!(_ >= a && _ < l)) {
        n.delete(_);
        try {
          S.el.remove();
        } catch {}
        try {
          S.dispose();
        } catch {}
      }
    let { _skalTopSpacer: c, _skalBottomSpacer: g } = e;
    c || (c = document.createElement("div"), c._skalSpacer = true, e._skalTopSpacer = c, g = document.createElement("div"), g._skalSpacer = true, e._skalBottomSpacer = g);
    const f = Zi(e);
    c.style.height = `${Math.max(0, a) * f}px`, g.style.height = `${Math.max(0, i - l) * f}px`, e.appendChild(c);
    for (let _ = a;_ < l; _++)
      n.has(_) || eo(e, n, _, r), e.appendChild(n.get(_).el);
    e.appendChild(g);
    for (let _ = a;_ < l; _++)
      Ms(e, n.get(_).el);
  }
  function to(e) {
    e._skalWindowOff && (e._skalWindowOff(), e._skalWindowOff = null), e._skalWindowArmed = false, e._skalTopSpacer = null, e._skalBottomSpacer = null;
    const r = e._skalRows;
    if (r) {
      e._skalRenderItem = null;
      for (const n of r.values())
        try {
          n.dispose();
        } catch {}
      r.clear(), e._skalRows = null;
    }
  }
  var Hs = ai({ createElement(e) {
    const r = cs[e];
    if (r === undefined) {
      Ds(e);
      const i = document.createElement("div");
      return i._skalTag = e, i.setAttribute("data-skal-unknown", e), i.style.outline = "1px dashed #d33", i.style.padding = "4px", i.style.color = "#d33", i.style.font = "11px ui-monospace, monospace", i.appendChild(document.createTextNode(`<${e}>`)), i;
    }
    const n = document.createElement(r);
    return n._skalTag = e, Ss(n, e), n;
  }, createTextNode(e) {
    return document.createTextNode(e == null ? "" : String(e));
  }, replaceText(e, r) {
    e.data = r == null ? "" : String(r);
  }, setProperty(e, r, n, i) {
    const a = e._skalTag;
    if (a === "flutterEmbed") {
      if (r === "widget") {
        e._skalEmbedWidget = n == null ? "" : String(n), xn(e);
        return;
      }
      if (r === "props") {
        e._skalEmbedProps = n && typeof n == "object" ? n : {}, xn(e);
        return;
      }
    }
    if (a === "listView") {
      if (r === "renderItem") {
        e._skalRenderItem = typeof n == "function" ? n : null, Qi(e), Pr(e);
        return;
      }
      if (r === "count") {
        e._skalRowCount = Math.max(0, n | 0), Qi(e), Pr(e);
        return;
      }
    }
    if (a === "tabs") {
      if (r === "activeTab") {
        e._skalActiveTab = n | 0, Rr(e);
        return;
      }
      if (r === "onChange") {
        e._skalOnChange = typeof n == "function" ? n : null;
        return;
      }
    } else if (a === "tab" && (r === "title" || r === "icon")) {
      r === "title" ? e._skalTitle = n == null ? "" : String(n) : e._skalIcon = n == null ? "" : String(n);
      const c = e.parentElement;
      c && c._skalTag === "tabs" && Rr(c);
      return;
    }
    if (r === "onClick" || r === "onclick" || r === "onTap") {
      e.onclick = typeof n == "function" ? n : null;
      return;
    }
    if (r === "onDoubleTap") {
      e.ondblclick = typeof n == "function" ? n : null;
      return;
    }
    if (r === "onChange") {
      e.oninput = typeof n == "function" ? n : null;
      return;
    }
    if (r === "onSubmit") {
      e.onkeydown = typeof n == "function" ? (c) => {
        c.key === "Enter" && n(e.value);
      } : null;
      return;
    }
    if (r === "onLongPress") {
      e.oncontextmenu = typeof n == "function" ? (c) => {
        c.preventDefault(), n(c);
      } : null;
      return;
    }
    const l = $s[r];
    if (l !== undefined) {
      (e._skalG ||= {})[l] = typeof n == "function" ? n : null, Tn(e);
      return;
    }
    if (r === "draggable") {
      const c = e._skalG ||= {};
      c.draggable = typeof n == "string" ? Ps[n] || 0 : n === true ? 1 : n | 0, Tn(e);
      return;
    }
    if (r === "release") {
      const c = e._skalG ||= {};
      c.release = typeof n == "string" ? As[n.toLowerCase()] || 0 : n === true ? 1 : n | 0, Tn(e);
      return;
    }
    if (r === "spring") {
      const c = typeof n == "string" ? Os[n] || 0 : n === true ? 1 : n | 0;
      if (c) {
        const g = c === 2 ? "cubic-bezier(0.34, 1.56, 0.64, 1)" : c === 3 ? "cubic-bezier(0.22, 1, 0.36, 1)" : "cubic-bezier(0.4, 0, 0.2, 1)", f = c === 2 ? 620 : c === 3 ? 340 : 460;
        e.style.transition = `transform ${f}ms ${g}, opacity ${f}ms ${g}`;
      } else
        e.style.transition = "";
      return;
    }
    if (r === "label" && (e._skalTag === "button" || e._skalTag === "text")) {
      e.textContent = n == null ? "" : String(n);
      return;
    }
    if (r === "title" && e._skalTag === "listTile") {
      e.textContent = n == null ? "" : String(n);
      return;
    }
    if (r === "animate" && n && typeof n == "object") {
      const c = n.duration | 0;
      let g = n.curve;
      g = typeof g == "string" ? xs[g] ?? 0 : g | 0;
      const f = n.delay | 0;
      e.style.transition = `all ${c}ms ${ks[g] || "linear"} ${f}ms`;
      return;
    }
    if (n == null) {
      Cs(e, r);
      return;
    }
    Is(e, r, n);
  }, insertNode(e, r, n) {
    e._skalTag === "tabs" && e._skalBar && !n ? e.insertBefore(r, e._skalBar) : e.insertBefore(r, n || null), e._skalTag === "pageView" && r.style && (r.style.flex = "0 0 100%", r.style.scrollSnapAlign = "start"), e._skalTag === "tabs" && r._skalTag === "tab" && Rr(e), r._skalTag === "flutterEmbed" && xn(r);
  }, removeNode(e, r) {
    e.removeChild(r), e._skalTag === "tabs" && r._skalTag === "tab" && Rr(e), r._skalTag === "flutterEmbed" && ms(r), r._skalRows && to(r);
  }, isTextNode(e) {
    return e.nodeType === 3;
  }, getParentNode(e) {
    return e.parentNode;
  }, getFirstChild(e) {
    return e.firstChild;
  }, getNextSibling(e) {
    return e.nextSibling;
  } }), { render: ro, effect: Vs, memo: Sd, createComponent: yd, createElement: ut, createTextNode: Us, insertNode: bt, insert: Gs, spread: xd, setProp: he, mergeProps: kd, use: Td } = Hs;
  function J(e) {
    return function() {
      throw new Error(`Skal: <${e}> was used without the babel-plugin-skal-jsx transform. Add the plugin to your Vite/babel config \u2014 see examples/kitchen-sink/vite.config.js for an example. (This wrapper exists as a fallback so misconfigured builds fail loud rather than rendering blanks.)`);
    };
  }
  var Ed = J("Box"), Rd = J("Container"), $d = J("Column"), Pd = J("Row"), Ad = J("Text"), Od = J("Button"), Fd = J("ScrollView"), Cd = J("ListView"), Id = J("ReorderableListView"), Dd = J("Image"), zd = J("Stack"), Ld = J("Switch"), Md = J("Slider"), Bd = J("Checkbox"), Nd = J("ActivityIndicator"), Wd = J("ProgressBar"), Hd = J("LazyGrid"), Vd = J("Wrap"), Ud = J("SafeArea"), Gd = J("RichText"), jd = J("TextInput"), qd = J("Navigator"), Xd = J("Screen"), Kd = J("Tabs"), Yd = J("Tab"), Jd = J("AnimatedList"), Zd = J("CrossFade"), Qd = J("Hero"), eh = J("ListTile"), th = J("PageView"), rh = J("Dismissible"), nh = J("CustomScrollView"), ih = J("SliverAppBar"), oh = J("SliverList"), ah = J("SliverGrid"), sh = J("Canvas"), lh = J("DragItem"), ch = J("DropZone"), uh = J("Radio"), fh = J("Chip"), dh = J("SegmentedButton"), hh = J("ExpansionTile"), gh = J("Dropdown"), ph = J("Stepper"), _h = J("Step"), bh = J("Drawer"), vh = J("BottomSheet"), mh = J("BackdropFilter"), wh = J("InteractiveViewer"), Sh = J("FlutterEmbed"), yh = J("HtmlEmbed"), no = new Map;
  function er(e, r) {
    if (typeof e != "string" || e.length === 0)
      throw new TypeError("registerHtmlView: viewType must be a non-empty string");
    if (typeof r != "function")
      throw new TypeError("registerHtmlView: factory must be a function");
    no.set(e, r);
    const n = globalThis.__skalRegisterHtmlView;
    typeof n == "function" && n(e);
  }
  typeof globalThis < "u" && (globalThis.__skalCreateHtmlViewElement = function(e, r) {
    const n = no.get(e), i = document.createElement("div");
    if (i.setAttribute("data-skal-view-type", e), i.setAttribute("data-skal-view-id", String(r)), i.style.cssText = "width:100%;height:100%;box-sizing:border-box;", !n)
      return i.textContent = `<HtmlEmbed viewType="${e}"> \u2014 no factory registered`, i.style.cssText += "color:#d33;font:12px ui-monospace,monospace;padding:8px;border:1px dashed #d33;background:#fff5f5;", i;
    try {
      n(i, r);
    } catch (a) {
      console.error(`Skal registerHtmlView('${e}') factory threw:`, a), i.textContent = `<HtmlEmbed viewType="${e}"> factory threw: ${a}`, i.style.cssText += "color:#d33;font:12px ui-monospace,monospace;padding:8px;";
    }
    return i;
  });
  function js() {
    let e = 0;
    const r = function() {};
    return r.__skalBind = (n) => {
      e = n;
    }, new Proxy(r, { apply(n, i, a) {
      const l = a[0];
      l && typeof l.id == "number" && (e = l.id);
    }, get(n, i) {
      if (i === "__skalBind" || typeof i == "symbol")
        return r[i];
      if (typeof i == "string" && i.endsWith("$") && i.length > 1) {
        const a = i.slice(0, -1);
        return (...l) => {
          if (e === 0)
            throw new Error(`skal ref: cannot call .${String(i)}() before the host mounts. Move the call into a JSX event handler.`);
          const c = qs(l, `ref .${String(i)}()`);
          return Ca(e, a, c.args, c.onValue, c.opts);
        };
      }
      return (...a) => e === 0 ? Promise.reject(new Error(`skal ref: cannot call .${String(i)}() before the host mounts. Move the call into a JSX event handler.`)) : _t(e, i, a);
    } });
  }
  function qs(e, r) {
    const n = e[e.length - 1];
    if (typeof n == "function")
      return { args: e.slice(0, -1), onValue: n, opts: undefined };
    if (n && typeof n == "object" && typeof n.onValue == "function")
      return { args: e.slice(0, -1), onValue: n.onValue, opts: { onError: n.onError, onDone: n.onDone } };
    throw new TypeError(`skal ${r} requires a callback \u2014 or an { onValue, onError?, onDone? } object \u2014 as its last argument (got ${n === null ? "null" : typeof n})`);
  }
  var Xs = 0, Ks = 0;
  function io(e, r) {
    const n = globalThis.__skalHot && globalThis.__skalHot.stash;
    if (!n)
      return q(r);
    const [i, a] = q(n.has(e) ? n.get(e) : r);
    return [i, (l) => {
      const c = a(l);
      return n.set(e, i()), c;
    }];
  }
  function Ys(e, r) {
    return io("hotstate:" + (r ?? Xs++), e);
  }
  function Rn(e, r, n) {
    const i = (F) => {
      const z = e[F];
      return typeof z == "function" ? z : z && z.component || null;
    }, a = (F) => {
      const z = e[F];
      return z && typeof z == "object" ? z.title : undefined;
    }, l = (F) => {
      const z = e[F];
      return z && typeof z == "object" ? z.transition : undefined;
    }, c = (F) => F === "fade" ? 1 : F === "none" ? 2 : typeof F == "number" ? F : 0, g = !!(n && n.linking), f = typeof window < "u", _ = () => {
      if (!f)
        return null;
      const F = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
      return F && e[F] ? F : null;
    };
    let S = typeof r == "string" ? r : r && r.name || Object.keys(e)[0];
    if (g) {
      const F = _();
      F && (S = F);
    }
    const w = [{ name: S, params: {}, title: a(S), transition: l(S) }], [P, p] = io("router:" + (n && n.key != null ? n.key : Ks++), w), I = P();
    Array.isArray(I) && I.length > 0 && I.every((F) => F && e[F.name]) || p(w);
    const R = { stack: P, navigate(F, z, E) {
      p([...P(), { name: F, params: z || {}, presentation: E && E.presentation, title: (E && E.title) !== undefined ? E.title : a(F), transition: (E && E.transition) !== undefined ? E.transition : l(F) }]);
    }, back() {
      const F = P();
      F.length > 1 && p(F.slice(0, -1));
    }, replace(F, z, E) {
      p([...P().slice(0, -1), { name: F, params: z || {}, title: (E && E.title) !== undefined ? E.title : a(F), transition: (E && E.transition) !== undefined ? E.transition : l(F) }]);
    }, reset(F, z) {
      p([{ name: F, params: z || {}, title: a(F), transition: l(F) }]);
    }, canGoBack() {
      return P().length > 1;
    } };
    return g && f && Rt(() => {
      const F = P(), z = "#/" + F[F.length - 1].name;
      window.location.hash !== z && window.history.replaceState({}, "", z);
    }), R.View = () => (() => {
      var F = s("navigator");
      return t(F, "onPop", () => R.back()), B(F, L(ue, { get each() {
        return P();
      }, children: (z) => {
        const E = i(z.name);
        return (() => {
          var A = s("screen");
          return B(A, E ? L(E, { get params() {
            return z.params || {};
          }, router: R }) : null), G((h) => {
            var y = z.presentation === "modal" ? 1 : 0, $ = z.title || "", D = c(z.transition);
            return y !== h.e && (h.e = t(A, "presentation", y, h.e)), $ !== h.t && (h.t = t(A, "title", $, h.t)), D !== h.a && (h.a = t(A, "transition", D, h.a)), h;
          }, { e: undefined, t: undefined, a: undefined }), A;
        })();
      } })), F;
    })(), R;
  }
  var Ar = Symbol("store-raw"), vt = Symbol("store-node"), je = Symbol("store-has"), oo = Symbol("store-self");
  function ao(e) {
    let r = e[Le];
    if (!r && (Object.defineProperty(e, Le, { value: r = new Proxy(e, Qs) }), !Array.isArray(e))) {
      const n = Object.keys(e), i = Object.getOwnPropertyDescriptors(e), a = Object.getPrototypeOf(e), l = a !== null && e !== null && typeof e == "object" && !Array.isArray(e) && a !== Object.prototype;
      if (l) {
        const c = Object.getOwnPropertyDescriptors(a);
        n.push(...Object.keys(c)), Object.assign(i, c);
      }
      for (let c = 0, g = n.length;c < g; c++) {
        const f = n[c];
        l && f === "constructor" || i[f].get && Object.defineProperty(e, f, { configurable: true, enumerable: i[f].enumerable, get: i[f].get.bind(r) });
      }
    }
    return r;
  }
  function zt(e) {
    let r;
    return e != null && typeof e == "object" && (e[Le] || !(r = Object.getPrototypeOf(e)) || r === Object.prototype || Array.isArray(e));
  }
  function Lt(e, r = new Set) {
    let n, i, a, l;
    if (n = e != null && e[Ar])
      return n;
    if (!zt(e) || r.has(e))
      return e;
    if (Array.isArray(e)) {
      Object.isFrozen(e) ? e = e.slice(0) : r.add(e);
      for (let c = 0, g = e.length;c < g; c++)
        a = e[c], (i = Lt(a, r)) !== a && (e[c] = i);
    } else {
      Object.isFrozen(e) ? e = Object.assign({}, e) : r.add(e);
      const c = Object.keys(e), g = Object.getOwnPropertyDescriptors(e);
      for (let f = 0, _ = c.length;f < _; f++)
        l = c[f], !g[l].get && (a = e[l], (i = Lt(a, r)) !== a && (e[l] = i));
    }
    return e;
  }
  function Or(e, r) {
    let n = e[r];
    return n || Object.defineProperty(e, r, { value: n = Object.create(null) }), n;
  }
  function tr(e, r, n) {
    if (e[r])
      return e[r];
    const [i, a] = q(n, { equals: false, internal: true });
    return i.$ = a, e[r] = i;
  }
  function Js(e, r) {
    const n = Reflect.getOwnPropertyDescriptor(e, r);
    return !n || n.get || !n.configurable || r === Le || r === vt || (delete n.value, delete n.writable, n.get = () => e[Le][r]), n;
  }
  function so(e) {
    Br() && tr(Or(e, vt), oo)();
  }
  function Zs(e) {
    return so(e), Reflect.ownKeys(e);
  }
  var Qs = { get(e, r, n) {
    if (r === Ar)
      return e;
    if (r === Le)
      return n;
    if (r === dr)
      return so(e), n;
    const i = Or(e, vt), a = i[r];
    let l = a ? a() : e[r];
    if (r === vt || r === je || r === "__proto__")
      return l;
    if (!a) {
      const c = Object.getOwnPropertyDescriptor(e, r);
      Br() && (typeof l != "function" || e.hasOwnProperty(r)) && !(c && c.get) && (l = tr(i, r, l)());
    }
    return zt(l) ? ao(l) : l;
  }, has(e, r) {
    return r === Ar || r === Le || r === dr || r === vt || r === je || r === "__proto__" ? true : (Br() && tr(Or(e, je), r)(), (r in e));
  }, set() {
    return true;
  }, deleteProperty() {
    return true;
  }, ownKeys: Zs, getOwnPropertyDescriptor: Js };
  function Mt(e, r, n, i = false) {
    if (r === "__proto__" || !i && e[r] === n)
      return;
    const a = e[r], l = e.length;
    n === undefined ? (delete e[r], e[je] && e[je][r] && a !== undefined && e[je][r].$()) : (e[r] = n, e[je] && e[je][r] && a === undefined && e[je][r].$());
    let c = Or(e, vt), g;
    if ((g = tr(c, r, a)) && g.$(() => n), Array.isArray(e) && e.length !== l) {
      for (let f = e.length;f < l; f++)
        (g = c[f]) && g.$();
      (g = tr(c, "length", l)) && g.$(e.length);
    }
    (g = c[oo]) && g.$();
  }
  function lo(e, r) {
    const n = Object.keys(r);
    for (let i = 0;i < n.length; i += 1) {
      const a = n[i];
      co(a) || Mt(e, a, r[a]);
    }
  }
  function co(e) {
    return e === "__proto__" || e === "constructor" || e === "prototype";
  }
  function el(e, r) {
    if (typeof r == "function" && (r = r(e)), r = Lt(r), Array.isArray(r)) {
      if (e === r)
        return;
      let n = 0, i = r.length;
      for (;n < i; n++) {
        const a = r[n];
        e[n] !== a && Mt(e, n, a);
      }
      Mt(e, "length", i);
    } else
      lo(e, r);
  }
  function rr(e, r, n = []) {
    let i, a = e;
    if (r.length > 1) {
      i = r.shift();
      const c = typeof i, g = Array.isArray(e);
      if (c === "string" && (i === "__proto__" || r.length > 1 && co(i)))
        return;
      if (Array.isArray(i)) {
        for (let f = 0;f < i.length; f++)
          rr(e, [i[f]].concat(r), n);
        return;
      } else if (g && c === "function") {
        for (let f = 0;f < e.length; f++)
          i(e[f], f) && rr(e, [f].concat(r), n);
        return;
      } else if (g && c === "object") {
        const { from: f = 0, to: _ = e.length - 1, by: S = 1 } = i;
        for (let w = f;w <= _; w += S)
          rr(e, [w].concat(r), n);
        return;
      } else if (r.length > 1) {
        rr(e[i], r, [i].concat(n));
        return;
      }
      a = e[i], n = [i].concat(n);
    }
    let l = r[0];
    typeof l == "function" && (l = l(a, n), l === a) || i === undefined && l == null || (l = Lt(l), i === undefined || zt(a) && zt(l) && !Array.isArray(l) ? lo(a, l) : Mt(e, i, l));
  }
  function tl(...[e, r]) {
    const n = Lt(e || {}), i = Array.isArray(n), a = ao(n);
    function l(...c) {
      Xn(() => {
        i && c.length === 1 ? el(n, c[0]) : rr(n, c);
      });
    }
    return [a, l];
  }
  var Fr = new WeakMap, uo = { get(e, r) {
    if (r === Ar)
      return e;
    const n = e[r];
    if (r === Le || r === dr || r === vt || r === je || r === "__proto__")
      return n;
    let i;
    return zt(n) ? Fr.get(n) || (Fr.set(n, i = new Proxy(n, uo)), i) : n;
  }, set(e, r, n) {
    return Mt(e, r, Lt(n)), true;
  }, deleteProperty(e, r) {
    return Mt(e, r, undefined, true), true;
  } };
  function Cr(e) {
    return (r) => {
      if (zt(r)) {
        let n;
        (n = Fr.get(r)) || Fr.set(r, n = new Proxy(r, uo)), e(n);
      }
      return r;
    };
  }
  var xh = 15, rl = (() => {
    const e = new Uint32Array(256);
    for (let r = 0;r < 256; r++) {
      let n = r;
      for (let i = 0;i < 8; i++)
        n = n & 1 ? 3988292384 ^ n >>> 1 : n >>> 1;
      e[r] = n >>> 0;
    }
    return e;
  })();
  function fo(e, r = 0, n = e.length) {
    let i = 4294967295;
    for (let a = r;a < n; a++)
      i = rl[(i ^ e[a]) & 255] ^ i >>> 8;
    return (i ^ 4294967295) >>> 0;
  }
  function ho(e, r, n, i, a, l) {
    const c = 15 + a.length + l.length, g = new DataView(e.buffer, e.byteOffset + r, c);
    return g.setUint32(4, n >>> 0, true), e[r + 8] = i & 255, g.setUint16(9, a.length, true), g.setUint32(11, l.length, true), e.set(a, r + 15), e.set(l, r + 15 + a.length), g.setUint32(0, fo(e, r + 4, r + c), true), c;
  }
  function Ir(e, r, n = true) {
    if (r + 15 > e.length)
      return null;
    const i = new DataView(e.buffer, e.byteOffset, e.byteLength), a = i.getUint32(r, true), l = i.getUint32(r + 4, true), c = e[r + 8], g = i.getUint16(r + 9, true), f = i.getUint32(r + 11, true), _ = 15 + g + f;
    if (r + _ > e.length || n && fo(e, r + 4, r + _) !== a)
      return null;
    const S = r + 15, w = S + g;
    return { seq: l, flags: c, total: _, key: e.subarray(S, w), value: e.subarray(w, w + f) };
  }
  var mt = 256 * 1024, nl = 0.4, il = 1000, ol = 8, al = 16, sl = new TextEncoder, ll = new TextDecoder, $n = (e) => sl.encode(e), Pn = (e) => ll.decode(e), go = () => Date.now(), po = new Uint8Array(0), _o = 1397442609, An = new Function("m", "return import(m);"), On = (e, r) => e && e[r] ? e : e && e.default || e, Fn = class {
    constructor() {
      this.kind = "memory", this._segs = new Map, this._meta = new Map;
    }
    listSegments() {
      return [...this._segs.keys()].sort((e, r) => e - r);
    }
    appendSegment(e, r) {
      let n = this._segs.get(e);
      n || (n = { buf: new Uint8Array(Math.max(1024, r.length * 2)), len: 0 }, this._segs.set(e, n));
      const i = n.len + r.length;
      if (i > n.buf.length) {
        let a = n.buf.length || 1024;
        for (;a < i; )
          a *= 2;
        const l = new Uint8Array(a);
        l.set(n.buf.subarray(0, n.len)), n.buf = l;
      }
      n.buf.set(r, n.len), n.len = i;
    }
    getSegment(e) {
      const r = this._segs.get(e);
      return r ? r.buf.subarray(0, r.len) : null;
    }
    dropSegment(e) {
      this._segs.delete(e);
    }
    flush() {}
    metaGet(e) {
      return this._meta.get(e) || null;
    }
    metaPut(e, r) {
      this._meta.set(e, r.slice());
    }
  }, cl = class {
    constructor(e, r, n) {
      this.kind = "fs", this._fs = e, this._p = r, this.root = n;
    }
    _seg(e) {
      return this._p.join(this.root, `seg-${String(e).padStart(5, "0")}.log`);
    }
    listSegments() {
      let e = [];
      try {
        e = this._fs.readdirSync(this.root);
      } catch {
        return [];
      }
      return e.filter((r) => /^seg-\d+\.log$/.test(r)).map((r) => parseInt(r.slice(4), 10)).sort((r, n) => r - n);
    }
    appendSegment(e, r) {
      this._fs.appendFileSync(this._seg(e), r);
    }
    getSegment(e) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._seg(e)));
      } catch {
        return null;
      }
    }
    dropSegment(e) {
      try {
        this._fs.unlinkSync(this._seg(e));
      } catch {}
    }
    flush() {}
    metaGet(e) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._p.join(this.root, `meta-${e}`)));
      } catch {
        return null;
      }
    }
    metaPut(e, r) {
      this._fs.writeFileSync(this._p.join(this.root, `meta-${e}`), r);
    }
  }, ul = class {
    constructor(e, r, n, i) {
      this.kind = "mmap", this.directActive = true, this._mmap = e, this._fs = r, this._p = n, this.root = i, this._open = new Map;
      try {
        for (const a of r.readdirSync(i))
          if (a.endsWith(".dead"))
            try {
              r.unlinkSync(n.join(i, a));
            } catch {}
      } catch {}
    }
    _segPath(e) {
      return this._p.join(this.root, `seg-${String(e).padStart(5, "0")}.log`);
    }
    _handle(e) {
      let r = this._open.get(e);
      if (r)
        return this._open.delete(e), this._open.set(e, r), r;
      const n = this._mmap(this._segPath(e), { shared: true });
      let i = 0;
      for (;i < n.length; ) {
        const a = Ir(n, i);
        if (!a)
          break;
        i += a.total;
      }
      return r = { mapped: n, cursor: i }, this._open.set(e, r), this._evictOpen(e), r;
    }
    _evictOpen(e) {
      for (;this._open.size > al; ) {
        const r = this._open.keys().next().value;
        if (r === e)
          break;
        this._open.delete(r);
      }
    }
    createSegment(e, r) {
      const n = this._segPath(e);
      this._fs.writeFileSync(n, new Uint8Array(r));
      const i = { mapped: this._mmap(n, { shared: true }), cursor: 0 };
      return this._open.set(e, i), this._evictOpen(e), i;
    }
    segmentCapacity(e) {
      const r = this._open.get(e);
      if (r)
        return r.mapped.length;
      try {
        return this._handle(e).mapped.length;
      } catch {
        return 0;
      }
    }
    listSegments() {
      let e = [];
      try {
        e = this._fs.readdirSync(this.root);
      } catch {
        return [];
      }
      return e.filter((r) => /^seg-\d+\.log$/.test(r)).map((r) => parseInt(r.slice(4), 10)).sort((r, n) => r - n);
    }
    segmentLen(e) {
      try {
        return this._handle(e).cursor;
      } catch {
        return 0;
      }
    }
    reserve(e, r) {
      const n = this._handle(e), i = n.cursor;
      return n.cursor += r, { mapped: n.mapped, offset: i };
    }
    getSegment(e) {
      let r;
      try {
        r = this._handle(e);
      } catch {
        return null;
      }
      return r.mapped.subarray(0, r.cursor);
    }
    dropSegment(e) {
      this._open.delete(e);
      try {
        this._fs.renameSync(this._segPath(e), this._segPath(e) + ".dead");
      } catch {}
    }
    flush() {}
    metaGet(e) {
      try {
        return new Uint8Array(this._fs.readFileSync(this._p.join(this.root, `meta-${e}`)));
      } catch {
        return null;
      }
    }
    metaPut(e, r) {
      this._fs.writeFileSync(this._p.join(this.root, `meta-${e}`), r);
    }
  };
  function nr(e, r) {
    return e.diag = r, e;
  }
  async function fl(e) {
    let r, n, i;
    try {
      const c = Promise.all([An("node:fs"), An("node:os"), An("node:path")]), g = new Promise((w, P) => setTimeout(() => P(new Error("module import timed out")), 2000)), [f, _, S] = await Promise.race([c, g]);
      if (r = On(f, "readFileSync"), n = On(_, "tmpdir"), i = On(S, "join"), typeof r.readFileSync != "function" || typeof r.writeFileSync != "function" || typeof n.tmpdir != "function" || typeof i.join != "function")
        return nr(new Fn, "node:fs/os/path resolved but missing methods");
    } catch (c) {
      return nr(new Fn, "node: import failed \u2014 " + (c && c.message || c));
    }
    const a = e && e.length ? e : i.join(n.tmpdir(), "skal-store");
    let l = "";
    try {
      if (typeof Bun < "u" && typeof Bun.mmap == "function") {
        const c = i.join(a, "mmap");
        r.mkdirSync(c, { recursive: true });
        const g = i.join(c, ".mmap-probe");
        r.writeFileSync(g, new Uint8Array(64));
        const f = Bun.mmap(g, { shared: true });
        if (f && f.length >= 64)
          return nr(new ul((_, S) => Bun.mmap(_, S), r, i, c), "mmap @ " + c);
        l += "Bun.mmap probe unusable; ";
      } else
        l += "Bun.mmap absent; ";
    } catch (c) {
      l += "mmap \u2014 " + (c && c.message || c) + "; ";
    }
    try {
      if (typeof r.appendFileSync == "function") {
        const c = i.join(a, "fs");
        return r.mkdirSync(c, { recursive: true }), r.writeFileSync(i.join(c, ".fs-probe"), new Uint8Array(1)), nr(new cl(r, i, c), l + "fs @ " + c);
      }
      l += "fs.appendFileSync absent; ";
    } catch (c) {
      l += "fs \u2014 " + (c && c.message || c) + "; ";
    }
    return nr(new Fn, l + "memory fallback");
  }
  var dl = class {
    constructor(e) {
      this._b = e, this._keydir = new Map, this._dead = new Map, this._cache = new Map, this._seq = 0, this._active = null, this._lastHintMs = 0, this._maxSegId = -1;
    }
    get backendKind() {
      return this._b.kind;
    }
    open() {
      const e = this._b.listSegments(), r = this._loadHint(e);
      if (r && (this._keydir = r.keydir, this._dead = r.dead, this._seq = r.seq), e.length === 0) {
        const c = r ? r.tail.id : 0;
        this._maxSegId = c, this._active = this._b.directActive ? { id: c, direct: true } : { id: c, buf: new Uint8Array(mt), len: 0, persisted: 0 };
        return;
      }
      const n = e[e.length - 1], i = r ? Math.max(n, r.tail.id) : n, a = r ? r.tail.id : e[0];
      this._maxSegId = i;
      let l = null;
      for (const c of e) {
        if (c < a)
          continue;
        const g = this._b.getSegment(c) || new Uint8Array(0);
        let f = r && c === r.tail.id ? r.tail.len : 0;
        for (;f < g.length; ) {
          const _ = Ir(g, f);
          if (!_)
            break;
          const S = Pn(_.key), w = this._keydir.get(S);
          w && this._addDead(w.seg, w.len), _.flags & 1 ? (this._keydir.delete(S), this._addDead(c, _.total)) : this._keydir.set(S, { seg: c, off: f, len: _.total, seq: _.seq }), _.seq > this._seq && (this._seq = _.seq), f += _.total;
        }
        c === i ? l = g : this._cacheSet(c, g);
      }
      if (this._cache.delete(i), this._b.directActive)
        this._b.getSegment(i), this._active = { id: i, direct: true };
      else {
        l == null && (l = this._b.getSegment(i) || new Uint8Array(0));
        const c = new Uint8Array(Math.max(mt, l.length));
        c.set(l), this._active = { id: i, buf: c, len: l.length, persisted: l.length };
      }
    }
    _addDead(e, r) {
      this._dead.set(e, (this._dead.get(e) || 0) + r);
    }
    _cacheGet(e) {
      const r = this._cache.get(e);
      return r !== undefined && (this._cache.delete(e), this._cache.set(e, r)), r;
    }
    _cacheSet(e, r) {
      for (this._cache.delete(e), this._cache.set(e, r);this._cache.size > ol; )
        this._cache.delete(this._cache.keys().next().value);
    }
    _loadHint(e) {
      let r;
      try {
        r = this._b.metaGet("hint");
      } catch {
        return null;
      }
      if (!r || r.length < 20)
        return null;
      const n = new DataView(r.buffer, r.byteOffset, r.byteLength);
      if (n.getUint32(0, true) !== _o)
        return null;
      const i = n.getUint32(4, true), a = n.getUint32(8, true), l = n.getUint32(12, true), c = n.getUint32(16, true), g = new Set(e), f = new Map;
      let _ = 20;
      try {
        for (let P = 0;P < c; P++) {
          const p = n.getUint16(_, true);
          if (_ += 2, _ + p + 16 > r.length)
            return null;
          const I = Pn(r.subarray(_, _ + p));
          _ += p;
          const R = n.getUint32(_, true);
          _ += 4;
          const F = n.getUint32(_, true);
          _ += 4;
          const z = n.getUint32(_, true);
          _ += 4;
          const E = n.getUint32(_, true);
          if (_ += 4, !g.has(R))
            return null;
          f.set(I, { seg: R, off: F, len: z, seq: E });
        }
        const S = n.getUint32(_, true);
        _ += 4;
        const w = new Map;
        for (let P = 0;P < S; P++) {
          const p = n.getUint32(_, true);
          _ += 4, w.set(p, n.getUint32(_, true)), _ += 4;
        }
        return !g.has(a) && l !== 0 ? null : { seq: i, tail: { id: a, len: l }, keydir: f, dead: w };
      } catch {
        return null;
      }
    }
    _tailLen() {
      const e = this._active;
      return e ? e.direct ? this._b.segmentLen(e.id) : e.persisted : 0;
    }
    _writeHint() {
      this._lastHintMs = go();
      const e = this._active, r = [];
      let n = 20;
      for (const [c, g] of this._keydir) {
        const f = $n(c);
        r.push([f, g]), n += 2 + f.length + 16;
      }
      n += 4 + this._dead.size * 8;
      const i = new Uint8Array(n), a = new DataView(i.buffer);
      a.setUint32(0, _o, true), a.setUint32(4, this._seq >>> 0, true), a.setUint32(8, e ? e.id : 0, true), a.setUint32(12, this._tailLen(), true), a.setUint32(16, r.length, true);
      let l = 20;
      for (const [c, g] of r)
        a.setUint16(l, c.length, true), l += 2, i.set(c, l), l += c.length, a.setUint32(l, g.seg, true), l += 4, a.setUint32(l, g.off, true), l += 4, a.setUint32(l, g.len, true), l += 4, a.setUint32(l, g.seq >>> 0, true), l += 4;
      a.setUint32(l, this._dead.size, true), l += 4;
      for (const [c, g] of this._dead)
        a.setUint32(l, c, true), l += 4, a.setUint32(l, g, true), l += 4;
      try {
        this._b.metaPut("hint", i);
      } catch {}
    }
    _nextSegId() {
      const e = Math.max(this._active.id, this._maxSegId) + 1;
      return this._maxSegId = e, e;
    }
    _seal() {
      const e = this._active;
      if (e.direct) {
        this._active = { id: this._nextSegId(), direct: true };
        return;
      }
      e.len > e.persisted && this._b.appendSegment(e.id, e.buf.subarray(e.persisted, e.len)), this._cacheSet(e.id, e.buf.slice(0, e.len)), this._active = { id: this._nextSegId(), buf: new Uint8Array(mt), len: 0, persisted: 0 };
    }
    _writeFrame(e, r, n, i) {
      const a = 15 + n.length + i.length, l = this._active;
      if (l.direct) {
        const f = this._b.segmentCapacity(l.id);
        f === 0 ? this._b.createSegment(l.id, Math.max(mt, a)) : this._b.segmentLen(l.id) + a > f && (this._seal(), this._b.createSegment(this._active.id, Math.max(mt, a)));
        const _ = this._b.reserve(this._active.id, a);
        return ho(_.mapped, _.offset, e, r, n, i), _.offset;
      }
      l.len > 0 && l.len + a > mt && this._seal();
      const c = this._active;
      if (c.len + a > c.buf.length) {
        const f = new Uint8Array(Math.max(c.buf.length * 2, c.len + a));
        f.set(c.buf.subarray(0, c.len)), c.buf = f;
      }
      const g = c.len;
      return ho(c.buf, g, e, r, n, i), c.len += a, g;
    }
    put(e, r) {
      const n = ++this._seq, i = $n(e), a = this._writeFrame(n, 0, i, r), l = this._keydir.get(e);
      l && this._addDead(l.seg, l.len), this._keydir.set(e, { seg: this._active.id, off: a, len: 15 + i.length + r.length, seq: n });
    }
    del(e) {
      const r = this._keydir.get(e);
      r && (this._writeFrame(++this._seq, 1, $n(e), po), this._addDead(r.seg, r.len), this._keydir.delete(e));
    }
    delPrefix(e) {
      if (!e)
        return;
      const r = e + ".", n = e + "#", i = [];
      for (const a of this._keydir.keys())
        (a.startsWith(r) || a.startsWith(n)) && i.push(a);
      for (const a of i)
        this.del(a);
    }
    get(e) {
      const r = this._keydir.get(e);
      if (!r)
        return null;
      const n = this._segBytes(r.seg);
      if (!n)
        return null;
      const i = Ir(n, r.off, false);
      return !i || i.flags & 1 ? null : i.value.slice();
    }
    _segBytes(e) {
      if (this._active && e === this._active.id)
        return this._active.direct ? this._b.getSegment(e) : this._active.buf.subarray(0, this._active.len);
      let r = this._cacheGet(e);
      return r || (r = this._b.getSegment(e), r && this._cacheSet(e, r)), r;
    }
    flush() {
      const e = this._active;
      e && !e.direct && e.len > e.persisted && (this._b.appendSegment(e.id, e.buf.subarray(e.persisted, e.len)), e.persisted = e.len), this._b.flush(), go() - this._lastHintMs >= il && this._writeHint();
    }
    compact() {
      let e = -1, r = 0;
      for (const [c, g] of this._dead)
        this._active && c === this._active.id || g > r && (r = g, e = c);
      if (e < 0 || r < mt * nl)
        return false;
      const n = this._segBytes(e);
      if (!n)
        return false;
      const i = this._b.listSegments(), a = i.length > 0 && e === i[0];
      let l = 0;
      for (;l < n.length; ) {
        const c = Ir(n, l);
        if (!c)
          break;
        const g = Pn(c.key);
        if (c.flags & 1)
          !a && !this._keydir.has(g) && (this._writeFrame(++this._seq, 1, c.key, po), this._addDead(this._active.id, 15 + c.key.length));
        else {
          const f = this._keydir.get(g);
          f && f.seg === e && f.off === l && this.put(g, c.value.slice());
        }
        l += c.total;
      }
      return this.flush(), this._b.dropSegment(e), this._cache.delete(e), this._dead.delete(e), this._writeHint(), true;
    }
    stats() {
      let e = 0;
      for (const r of this._dead.values())
        e += r;
      return { backend: this._b.kind, records: this._keydir.size, segments: this._b.listSegments().length, activeSegment: this._active ? this._active.id : -1, deadBytes: e, seq: this._seq };
    }
  }, hl = class {
    constructor(e) {
      this.backendKind = "native", this._dir = e, this._h = 0;
    }
    open() {
      const e = globalThis.__skal_store_open;
      if (this._h = typeof e == "function" && e(this._dir) || 0, !this._h)
        throw new Error("skal-store: native engine open failed @ " + this._dir);
    }
    put(e, r) {
      globalThis.__skal_store_put(this._h, e, r);
    }
    del(e) {
      globalThis.__skal_store_del(this._h, e);
    }
    delPrefix(e) {
      const r = globalThis.__skal_store_del_prefix;
      typeof r == "function" && r(this._h, e);
    }
    get(e) {
      const r = globalThis.__skal_store_get(this._h, e);
      return r ? new Uint8Array(r) : null;
    }
    flush() {}
    compact() {
      return !!globalThis.__skal_store_compact(this._h);
    }
    stats() {
      const e = this._h ? globalThis.__skal_store_stats(this._h) : null;
      if (!e)
        return { backend: "native", records: 0, segments: 0, deadBytes: 0, seq: 0 };
      const r = new DataView(e);
      return { backend: "native", records: r.getUint32(0, true), segments: r.getUint32(4, true), deadBytes: r.getUint32(8, true), seq: r.getUint32(12, true) };
    }
  }, gl = 60, pl = 8192, Dr = Symbol("skal.indexDirty"), bo = class {
    constructor(e) {
      this.sp = e;
    }
  }, _l = new TextEncoder, bl = new TextDecoder;
  function wt(e) {
    return _l.encode(JSON.stringify(e));
  }
  function Me(e) {
    return JSON.parse(bl.decode(e));
  }
  var Cn = Symbol.for("skal.store"), Oe = (e) => e !== null && typeof e == "object" && !Array.isArray(e), qe = (e) => Array.isArray(e) && e.every(Oe), In = (e) => typeof e == "string" && /^(0|[1-9]\d*)$/.test(e), ve = (e, r) => e ? e + "." + r : r, ir = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
  function Bt(e) {
    if (Array.isArray(e))
      return e.map(Bt);
    if (Oe(e)) {
      const r = {};
      for (const n of Object.keys(e))
        r[n] = Bt(e[n]);
      return r;
    }
    return e;
  }
  async function vl() {
    const e = globalThis.__skal_data_dir;
    if (typeof e == "string" && e.length)
      return e;
    for (let r = 0;r < 5; r++) {
      try {
        const n = await Promise.race([$a(), new Promise((i, a) => setTimeout(() => a(new Error("getDataDir timeout")), 800))]);
        if (typeof n == "string" && n.length)
          return n;
      } catch {}
      await new Promise((n) => setTimeout(n, 150));
    }
    return "";
  }
  function ml(e, r = {}) {
    const n = { name: r.name || "store", paths: r.paths || null, residentMax: r.residentMax || 1e4, version: r.version || 0, migrate: r.migrate || null };
    let i = false, a = false;
    if (n.paths)
      for (const T in n.paths) {
        const b = n.paths[T];
        b && b.lazy === true && (i = true), b && b.persist === false && (a = true);
      }
    const l = new Map;
    function c(T) {
      const b = l.get(T);
      if (b)
        return b;
      let O = true, C = false;
      if (n.paths) {
        const o = [];
        for (const u in n.paths)
          (u === T || T.startsWith(u + ".")) && o.push(u);
        o.sort((u, d) => u.length - d.length);
        for (const u of o) {
          const d = n.paths[u];
          d.persist !== undefined && (O = d.persist), d.lazy !== undefined && (C = d.lazy);
        }
      }
      const k = { persist: O, lazy: C };
      return l.set(T, k), k;
    }
    const [g, f] = tl(Bt(e)), [_, S] = q(false), [w, P] = q("\u2026"), [p, I] = q(null);
    let R = null;
    const F = new Map, z = new Map, E = new Map, A = new Set;
    let h = null, y = 0;
    function $(T) {
      const b = z.get(T) || 1;
      return z.set(T, b + 1), String(b);
    }
    function D() {
      h == null && (h = setTimeout(() => {
        h = null, M();
      }, gl));
    }
    function M() {
      if (!(!R || F.size === 0 && A.size === 0)) {
        if (A.size > 0) {
          if (R.delPrefix)
            for (const T of A)
              R.delPrefix(T);
          A.clear();
        }
        for (const [T, b] of F)
          if (b === null)
            R.del(T);
          else if (b instanceof bo) {
            const O = le(b.sp);
            O !== undefined && R.put(T, wt(O));
          } else if (b === Dr) {
            const O = T.slice(2, -2), C = le(O === "" ? [] : O.split("."));
            Array.isArray(C) && R.put(T, wt({ ids: C.map((k) => k && k._id), nextId: z.get(O) || C.length + 1 }));
          } else
            R.put(T, b);
        F.clear(), R.flush(), y++;
      }
    }
    function U() {
      h != null && (clearTimeout(h), h = null), M();
    }
    function de(T, b, O) {
      const C = T.length;
      if (C === 0)
        return -1;
      let k = O >= 0 && O < C ? O : 0, o = k;
      for (;k >= 0 || o < C; ) {
        if (k >= 0) {
          const u = T[k];
          if (u && u._id === b)
            return k;
          k--;
        }
        if (o < C) {
          const u = T[o];
          if (u && u._id === b)
            return o;
          o++;
        }
      }
      return -1;
    }
    function ce(T) {
      const b = [];
      let O = g;
      for (const C of T)
        if (C !== null && typeof C == "object") {
          let k = -1;
          if (Array.isArray(O)) {
            const o = C.hint;
            o >= 0 && o < O.length && O[o] && O[o]._id === C.__id ? k = o : (k = de(O, C.__id, o), C.hint = k);
          }
          b.push(k), O = k < 0 ? undefined : O[k];
        } else
          b.push(C), O = O?.[C];
      return { path: b, value: O };
    }
    function le(T) {
      let b = g;
      for (let O = 0;O < T.length; O++) {
        const C = T[O];
        if (C !== null && typeof C == "object") {
          let k = -1;
          if (Array.isArray(b)) {
            const o = C.hint;
            o >= 0 && o < b.length && b[o] && b[o]._id === C.__id ? k = o : (k = de(b, C.__id, o), C.hint = k);
          }
          b = k < 0 ? undefined : b[k];
        } else
          b = b?.[C];
        if (b == null)
          return;
      }
      return b;
    }
    function Be(T, b) {
      let O = g;
      for (let C = 0;C < T.length; C++) {
        const k = T[C];
        if (k !== null && typeof k == "object") {
          let o = -1;
          if (Array.isArray(O)) {
            const u = k.hint;
            u >= 0 && u < O.length && O[u] && O[u]._id === k.__id ? o = u : (o = de(O, k.__id, u), k.hint = o);
          }
          O = o < 0 ? undefined : O[o];
        } else
          O = O?.[k];
        if (O == null)
          return;
      }
      return O[b];
    }
    function pe(T, ...b) {
      for (let O = 0;O < T.length; O++) {
        const C = T[O];
        if (C !== null && typeof C == "object") {
          const k = ce(T);
          if (k.path.indexOf(-1) >= 0)
            return;
          f(...k.path, ...b);
          return;
        }
      }
      f(...T, ...b);
    }
    const Pe = new Map;
    function or(T) {
      let b = e;
      for (const O of T.split(".")) {
        if (b == null)
          return;
        b = b[O];
      }
      return Bt(b);
    }
    function ar(T) {
      for (Pe.delete(T), Pe.set(T, true);Pe.size > n.residentMax; ) {
        const b = Pe.keys().next().value;
        if (b === T)
          break;
        Pe.delete(b), pe(b.split("."), or(b));
      }
    }
    function zn(T, b) {
      if (!(!R || Pe.has(b))) {
        if (Array.isArray(le(T)))
          Lr(T, b);
        else {
          const O = R.get("k:" + b);
          O != null && pe(T, Me(O));
        }
        ar(b);
      }
    }
    function Xe(T, b, O, C) {
      if (O) {
        F.set("k:" + O.storeKey, new bo(O.solidPath));
        return;
      }
      if (qe(C)) {
        for (const k of C)
          F.set("k:" + ve(b, k._id), wt(k));
        F.set("k:" + b + "#x", Dr);
        return;
      }
      if (b === "" && Oe(C)) {
        for (const k of Object.keys(C)) {
          const o = ve(b, k);
          c(o).persist && Xe([...T, k], o, null, C[k]);
        }
        return;
      }
      F.set("k:" + b, wt(C));
    }
    function Ln(T, b) {
      if (qe(b)) {
        for (const O of b)
          O && O._id != null && F.set("k:" + ve(T, O._id), null);
        F.set("k:" + T + "#x", null);
        return;
      }
      F.set("k:" + T, null), T && b !== null && typeof b == "object" && A.add(T);
    }
    function Mn(T, b, O, C) {
      let k = C;
      !O && qe(C) && (k = C.map((d) => d._id != null ? d : { ...d, _id: $(b) }));
      let o = false;
      for (let d = 0;d < T.length; d++) {
        const v = T[d];
        if (v !== null && typeof v == "object") {
          o = true;
          break;
        }
      }
      if (o) {
        const d = ce(T);
        if (d.path.indexOf(-1) >= 0)
          return;
        f(...d.path, k);
      } else
        f(...T, k);
      Array.isArray(k) && E.delete(b), b && Te.size > 0 && Ne(b, k !== null && typeof k == "object");
      let u = true;
      if (i || a) {
        const d = c(b);
        !O && d.lazy && ar(b), u = d.persist;
      }
      u && (!O && b && k !== null && typeof k == "object" && A.add(b), Xe(T, b, O, k), D());
    }
    const Te = new Map;
    let sr = new Set, lr = false;
    function Bn() {
      lr || (lr = true, queueMicrotask(cr));
    }
    function cr() {
      lr = false;
      const T = sr;
      sr = new Set;
      for (const b of T)
        if (!b._disposed) {
          b._dirty = false;
          try {
            xt(b);
          } catch (O) {
            console.error("[skal] effect threw:", O);
          }
        }
    }
    function xt(T) {
      const { _sps: b, _vals: O } = T;
      for (let C = 0;C < b.length; C++)
        O[C] = le(b[C]);
      T._fn(O);
    }
    function ur(T) {
      for (const b of T)
        b._dirty || (b._dirty = true, sr.add(b));
    }
    function Ne(T, b) {
      const O = Te.get(T);
      if (O && ur(O), b)
        if (T === "")
          for (const [, C] of Te)
            C !== O && ur(C);
        else {
          const C = T + ".";
          for (const [k, o] of Te)
            k.startsWith(C) && ur(o);
        }
      (O || b) && Bn();
    }
    function Nn(T, b) {
      const O = new Array(T.length);
      for (let o = 0;o < T.length; o++)
        O[o] = T[o].split(".");
      const C = { _fn: b, _paths: T, _sps: O, _vals: new Array(T.length), _dirty: false, _disposed: false };
      for (let o = 0;o < T.length; o++) {
        const u = T[o];
        let d = Te.get(u);
        d || (d = new Set, Te.set(u, d)), d.add(C);
      }
      const k = () => {
        if (!C._disposed) {
          C._disposed = true;
          for (let o = 0;o < C._paths.length; o++) {
            const u = Te.get(C._paths[o]);
            u && (u.delete(C), u.size === 0 && Te.delete(C._paths[o]));
          }
        }
      };
      try {
        xt(C);
      } catch (o) {
        throw k(), o;
      }
      return k;
    }
    const kt = { ready: _, backendKind: w, initTiming: p, flushNow: U, version: () => n.version, pending: () => F.size, flushes: () => y, resident: () => Pe.size, engineStats: () => R && R.stats ? R.stats() : null, createEffect: Nn }, rt = new Map;
    function dt(T, b, O, C) {
      C === undefined && (C = Array.isArray(le(T)));
      const k = rt.get(b);
      if (k !== undefined && k.isArray === C)
        return k.node;
      const o = C ? Hn(T, b, O) : Wn(T, b, O);
      return rt.set(b, { node: o, isArray: C }), rt.size > pl && rt.delete(rt.keys().next().value), o;
    }
    function Nt(T) {
      if (T.length) {
        for (const b of rt.keys())
          for (const O of T)
            if (b === O || b.startsWith(O + ".") || b.startsWith(O + "#")) {
              rt.delete(b);
              break;
            }
      }
    }
    function Wn(T, b, O) {
      return new Proxy({}, { get(C, k) {
        if (k === Cn)
          return kt;
        if (typeof k == "symbol")
          return;
        if (i && !O) {
          const u = b ? b + "." + k : k;
          !Pe.has(u) && c(u).lazy && ot(() => zn(T.length === 0 ? [k] : [...T, k], u));
        }
        const o = Be(T, k);
        return o !== null && typeof o == "object" ? dt(T.length === 0 ? [k] : [...T, k], b ? b + "." + k : k, O, Array.isArray(o)) : o;
      }, set(C, k, o) {
        return typeof k == "symbol" ? false : (Mn(T.length === 0 ? [k] : [...T, k], b ? b + "." + k : k, O, o), true);
      }, has(C, k) {
        const o = le(T);
        return o != null && k in o;
      }, ownKeys() {
        const C = le(T);
        return C ? Reflect.ownKeys(C) : [];
      }, getOwnPropertyDescriptor(C, k) {
        const o = le(T);
        if (o != null && k in o)
          return { enumerable: k !== "_id", configurable: true };
      }, deleteProperty(C, k) {
        if (typeof k == "symbol")
          return false;
        const o = b ? b + "." + k : k, u = le(T.length === 0 ? [k] : [...T, k]);
        return pe(T, Cr((d) => {
          d != null && delete d[k];
        })), O ? Xe(T, b, O, null) : (!a || c(o).persist) && Ln(o, u), u !== null && typeof u == "object" && (Nt([o]), E.delete(o)), o && Te.size > 0 && Ne(o, true), D(), true;
      } });
    }
    function Hn(T, b, O) {
      const C = () => le(T) || [], k = () => {
        (O || !a || c(b).persist) && Xe(T, b, O, C()), D();
      };
      function o(v, x, ...N) {
        const X = C(), K = X.length;
        v = v < 0 ? Math.max(0, K + v) : Math.min(v, K), x = x === undefined ? K - v : Math.max(0, Math.min(x, K - v));
        const j = X.slice(v, v + x);
        let Z = N;
        if (O || (Z = N.map((re) => Oe(re) && re._id == null ? { ...re, _id: $(b) } : re)), x === 0 && v === K && Z.length > 0)
          for (let re = 0;re < Z.length; re++)
            pe([...T, K + re], Z[re]);
        else
          pe(T, Cr((re) => {
            re.splice(v, x, ...Z);
          }));
        if (!O) {
          const re = [];
          for (const ye of j)
            if (ye && ye._id != null) {
              const Ce = ve(b, ye._id);
              F.set("k:" + Ce, null), re.push(Ce);
            }
          Nt(re);
        }
        let oe = false;
        if (!O) {
          const re = E.get(b);
          oe = re === undefined ? qe(X) : re, oe && (oe = Z.every(Oe)), E.set(b, oe);
        }
        if (oe) {
          for (const re of Z)
            re && re._id != null && F.set("k:" + ve(b, re._id), wt(re));
          F.set("k:" + b + "#x", Dr), D();
        } else
          k();
        return Te.size > 0 && Ne(b, true), j;
      }
      function u(v, x) {
        pe(T, Cr(v));
        const N = E.get(b);
        return x && !O && (N === undefined ? qe(C()) : N) ? (F.set("k:" + b + "#x", Dr), D()) : k(), Te.size > 0 && Ne(b, true), C();
      }
      const d = { splice: o, push: (...v) => (o(C().length, 0, ...v), C().length), unshift: (...v) => (o(0, 0, ...v), C().length), pop: () => o(C().length - 1, 1)[0], shift: () => o(0, 1)[0], sort: (v) => u((x) => {
        x.sort(v);
      }, true), reverse: () => u((v) => {
        v.reverse();
      }, true), fill: (v, x, N) => u((X) => {
        X.fill(v, x, N);
      }, false), copyWithin: (v, x, N) => u((X) => {
        X.copyWithin(v, x, N);
      }, false) };
      return new Proxy([], { get(v, x) {
        if (x === Cn)
          return kt;
        if (x === "length")
          return C().length;
        if (typeof x == "string" && Object.hasOwn(d, x))
          return d[x];
        if (In(x)) {
          const K = C(), j = +x, Z = K[j];
          if (Z !== null && typeof Z == "object") {
            let oe = false;
            if (!O) {
              const Ce = E.get(b);
              Ce === undefined ? (oe = qe(C()), E.set(b, oe)) : oe = Ce;
            }
            if (oe && Z._id != null) {
              const Ce = ve(b, Z._id), Ke = [...T, { __id: Z._id, hint: j }];
              return dt(Ke, Ce, { solidPath: Ke, storeKey: Ce }, false);
            }
            const re = ve(b, x), ye = [...T, j];
            return O ? dt(ye, re, O, Array.isArray(Z)) : dt(ye, re, { solidPath: T, storeKey: b }, Array.isArray(Z));
          }
          return Z;
        }
        const N = C(), X = N[x];
        return typeof X == "function" ? X.bind(N) : X;
      }, set(v, x, N) {
        if (x === "length") {
          const X = +N;
          let K = null;
          if (!O && X < C().length) {
            const j = E.get(b);
            (j === undefined ? qe(C()) : j) && (K = C().slice(X));
          }
          if (pe(T, Cr((j) => {
            j.length = X;
          })), E.delete(b), K) {
            const j = [];
            for (const Z of K)
              if (Z && Z._id != null) {
                const oe = ve(b, Z._id);
                F.set("k:" + oe, null), j.push(oe);
              }
            Nt(j);
          }
          return k(), Te.size > 0 && Ne(b, true), true;
        }
        if (In(x)) {
          const X = +x, K = C()[X];
          let j = N;
          !O && Oe(N) && N._id == null && (j = { ...N, _id: K && K._id != null ? K._id : $(b) }), pe(T, X, j);
          let Z = false;
          if (!O) {
            const oe = E.get(b);
            Z = oe === undefined ? qe(C()) : oe, Z && !Oe(j) && (Z = false), E.set(b, Z);
          }
          if (Z && j && j._id != null ? (F.set("k:" + ve(b, j._id), wt(j)), D()) : k(), Te.size > 0) {
            const oe = j !== null && typeof j == "object";
            Ne(ve(b, x), oe);
            const re = j && j._id != null ? j._id : null;
            Z && re != null && Ne(ve(b, re), oe);
            const ye = K && K._id != null ? K._id : null;
            ye != null && ye !== re && Ne(ve(b, ye), true);
          }
          return true;
        }
        return false;
      }, has(v, x) {
        return x === "length" || typeof x == "string" && Object.hasOwn(d, x) ? true : (x in C());
      }, ownKeys() {
        return Reflect.ownKeys(C());
      }, getOwnPropertyDescriptor(v, x) {
        const N = C();
        if (x === "length")
          return { value: N.length, writable: true, enumerable: false, configurable: false };
        if (In(x) && +x < N.length)
          return { enumerable: true, configurable: true };
      } });
    }
    function fr(T, b, O) {
      if (Array.isArray(T)) {
        const k = R.get("k:" + b + "#x");
        if (k != null) {
          O.push(b + "#x");
          const u = Me(k), d = [];
          for (const v of u.ids || []) {
            const x = ve(b, v);
            O.push(x);
            const N = R.get("k:" + x);
            N != null && d.push(Me(N));
          }
          return d;
        }
        const o = R.get("k:" + b);
        return o != null ? (O.push(b), Me(o)) : Bt(T);
      }
      if (Oe(T)) {
        const k = {};
        for (const o of Object.keys(T))
          k[o] = fr(T[o], ve(b, o), O);
        return k;
      }
      const C = R.get("k:" + b);
      return C != null ? (O.push(b), Me(C)) : T;
    }
    function zr(T, b) {
      if (qe(T)) {
        let O = 0;
        for (const C of T) {
          const k = C._id == null ? 0 : +C._id;
          k > O && (O = k);
        }
        O + 1 > (z.get(b) || 1) && z.set(b, O + 1);
        for (const C of T)
          C._id == null && (C._id = $(b));
      } else if (Oe(T))
        for (const O of Object.keys(T))
          zr(T[O], ve(b, O));
    }
    function Tt(T, b, O) {
      for (const C of Object.keys(T)) {
        const k = T[C], o = [...b, C], u = ve(O, C), d = c(u);
        if (Array.isArray(k))
          d.persist && !d.lazy && Lr(o, u);
        else if (Oe(k)) {
          let v = true;
          if (d.persist && !d.lazy && !F.has("k:" + u)) {
            const x = R.get("k:" + u);
            if (x != null) {
              const N = Me(x);
              pe(o, N), Oe(N) || (v = false, R.delPrefix && A.add(u));
            }
          }
          v && Tt(k, o, u);
        } else {
          if (!d.persist || d.lazy || F.has("k:" + u))
            continue;
          const v = R.get("k:" + u);
          if (v != null) {
            const x = Me(v);
            pe(o, x), Oe(x) && Tt(x, o, u);
          }
        }
      }
    }
    function Lr(T, b) {
      if (!c(b).persist || F.has("k:" + b + "#x") || F.has("k:" + b))
        return;
      E.delete(b);
      const O = R.get("k:" + b + "#x");
      if (O != null) {
        const o = Me(O);
        z.set(b, o.nextId || 1);
        const u = [];
        for (const d of o.ids || []) {
          const v = R.get("k:" + ve(b, d));
          v != null && u.push(Me(v));
        }
        pe(T, u);
        return;
      }
      const C = R.get("k:" + b);
      if (C != null) {
        pe(T, Me(C));
        return;
      }
      const k = le(T);
      Array.isArray(k) && k.length > 0 && qe(k) && Xe(T, b, null, k);
    }
    async function Vn() {
      const T = ir();
      let b = T, O = T, C = T;
      try {
        const d = await vl();
        if (b = ir(), typeof globalThis.__skal_store_open == "function" && d)
          try {
            const K = new hl(d + "/" + n.name);
            K.open(), R = K, P("native");
          } catch {
            R = null;
          }
        if (!R) {
          const K = await fl(d + "/" + n.name), j = new dl(K);
          j.open(), R = j, P(K.kind);
        }
        O = ir();
        let v = null;
        const x = R.get("k:#meta");
        if (x != null)
          try {
            v = Me(x);
          } catch {
            v = null;
          }
        const N = v ? v.version | 0 : 0;
        let X = false;
        if (v && v.shape && n.migrate && N < n.version) {
          const K = [], j = fr(v.shape, "", K);
          let Z = null;
          try {
            Z = n.migrate(j, N);
          } catch {
            Z = null;
          }
          if (Oe(Z)) {
            for (const oe of K)
              F.set("k:" + oe, null);
            zr(Z, ""), E.clear(), pe([], Z), Xe([], "", null, Z), X = true;
          }
        }
        (!v || N !== n.version) && F.set("k:#meta", wt({ version: n.version, shape: Bt(e) })), C = ir(), X || Tt(e, [], ""), D();
      } catch {}
      const k = ir(), o = R && R.stats ? R.stats() : null, u = (d) => Math.round(d * 10) / 10;
      I({ total: u(k - T), dir: u(b - T), open: u(O - b), migrate: u(C - O), hydrate: u(k - C), records: o ? o.records : 0 }), S(true);
    }
    return Vn(), dt([], "", null, Array.isArray(e));
  }
  function wl() {
    const [e, r] = q(0);
    return (() => {
      var n = ut("column"), i = ut("text"), a = ut("row"), l = ut("button"), c = ut("button"), g = ut("button"), f = ut("text");
      return bt(n, i), bt(n, a), bt(n, f), he(n, "gap", 8), he(n, "padding", 12), he(n, "background", "#FFF8FAFC"), he(n, "cornerRadius", 10), he(i, "fontSize", 13), he(i, "fontWeight", 600), he(i, "color", "#FF1A1A2E"), bt(a, l), bt(a, c), bt(a, g), he(a, "gap", 8), he(l, "label", "+1"), he(l, "onClick", () => r((_) => _ + 1)), he(c, "label", "-1"), he(c, "onClick", () => r((_) => _ - 1)), he(g, "label", "reset"), he(g, "onClick", () => r(0)), he(f, "label", "Same <Column>/<Text>/<Button> syntax as App.jsx \u2014 just compiled with moduleName: skal/renderer-web because this file is *.dom.jsx. The babel macro + skal-flutter codegen vocab work identically; only the sink (DOM vs bridge) changes."), he(f, "fontSize", 11), he(f, "color", "#FF4A4A5E"), Vs((_) => he(i, "label", `Skal JSX inside HtmlEmbed (DOM render) \u2014 n = ${e()}`, _)), n;
    })();
  }
  async function Sl() {
    return yn("geolocator.getCurrentPosition", {});
  }
  var Re = "#FFF2F2F7", $e = "#FFFFFFFF", xe = "#FFE5E5EA", Q = "#FF1C1C1E", H = "#FF8E8E93", se = "#FF0A84FF", ke = "#FF34C759", De = "#FFFF9F0A", St = "#FFFF3B30", Fe = "#FF5E5CE6", Se = "#FFEFEFF4", yl = "#FF334155", vo = typeof window < "u" && !vr;
  er("html-card", (e) => {
    e.innerHTML = `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; padding: 14px; background: linear-gradient(135deg, #fff 0%, #f0f4ff 100%); border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); height: 100%; box-sizing: border-box; overflow: auto;">
      <h3 style="margin: 0 0 6px; font-size: 14px; color: #1a1a2e;">Real DOM card</h3>
      <p style="margin: 0 0 10px; font-size: 12px; color: #4a4a5e; line-height: 1.4;">
        This whole panel is HTML rendered <strong>inside</strong> the Flutter canvas. Try to
        <em>select this text</em> with your mouse \u2014 selection works because the
        DOM is real, not a screenshot.
      </p>
      <button id="html-card-btn" style="padding: 6px 12px; border-radius: 6px; border: 0; background: #0a84ff; color: white; font-weight: 600; cursor: pointer; font-size: 12px;">
        Click me \u2014 0
      </button>
      <input type="date" style="margin-left: 8px; padding: 4px 6px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px;" />
    </div>
  `;
    let r = 0;
    e.querySelector("#html-card-btn").addEventListener("click", (n) => {
      r++, n.target.textContent = `Click me \u2014 ${r}`;
    });
  }), er("youtube-embed", (e) => {
    const r = document.createElement("iframe");
    r.src = "https://www.youtube.com/embed/dQw4w9WgXcQ", r.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"), r.setAttribute("allowfullscreen", ""), r.style.cssText = "width:100%;height:100%;border:0;border-radius:8px;display:block;", e.appendChild(r);
  });
  function yt(e, r, ...n) {
    const i = ut(e);
    if (r)
      for (const a in r) {
        const l = r[a];
        typeof l == "function" && a !== "onClick" && a !== "onChange" && a !== "onTap" ? Rt(() => he(i, a, l())) : he(i, a, l);
      }
    for (const a of n.flat())
      a == null || a === false || a === true || bt(i, typeof a == "object" && a.nodeType ? a : Us(String(a)));
    return i;
  }
  er("skal-jsx-counter", (e) => {
    ro(() => wl(), e);
  }), er("skal-counter", (e) => {
    nt(() => {
      const [r, n] = q(0);
      ro(() => yt("column", { gap: 8, padding: 12, background: "#FFF8FAFC", cornerRadius: 10 }, yt("text", { label: () => `Skal <column>+<text>+<button> rendered as DOM inside Flutter \u2014 n = ${r()}`, fontSize: 13, fontWeight: 600, color: "#FF1A1A2E" }), yt("row", { gap: 8 }, yt("button", { label: "+1", onClick: () => n((i) => i + 1) }), yt("button", { label: "-1", onClick: () => n((i) => i - 1) }), yt("button", { label: "reset", onClick: () => n(0) })), yt("text", { label: "These widgets reach Shape D via the same JSX `<Column>` / `<Button>` you write in App.jsx \u2014 just compiled against skal/renderer-web (Shape B DOM target) instead of the bridge. Pointer events, hover, focus, ARIA all stay live.", fontSize: 11, color: "#FF4A4A5E" })), e);
    });
  }), er("solid-counter", (e) => {
    nt(() => {
      const [r, n] = q(0), i = pr(() => r() % 2 === 0 ? "even" : "odd");
      e.innerHTML = `
      <div style="font-family:ui-sans-serif,system-ui,sans-serif;padding:14px;background:#f8fafc;border-radius:10px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;">
        <h3 style="margin:0;font-size:14px;color:#1a1a2e;">Solid signals \u2192 DOM inside Flutter</h3>
        <p style="margin:0;font-size:11px;color:#4a4a5e;line-height:1.4;">
          Same <code>createSignal</code> + <code>createMemo</code> Skal uses for the outer app \u2014 but bound to DOM via <code>createEffect</code> instead of the bridge renderer. Click the buttons; the DOM updates reactively, no manual diffing.
        </p>
        <div style="display:flex;gap:8px;align-items:center;">
          <button data-act="dec" style="padding:4px 10px;border-radius:6px;border:0;background:#ef4444;color:white;font-weight:600;cursor:pointer;font-size:12px;">\u22121</button>
          <button data-act="inc" style="padding:4px 10px;border-radius:6px;border:0;background:#22c55e;color:white;font-weight:600;cursor:pointer;font-size:12px;">+1</button>
          <span data-out="n" style="font-family:ui-monospace,monospace;font-size:13px;color:#1a1a2e;font-weight:600;"></span>
          <span data-out="parity" style="font-size:11px;padding:2px 8px;border-radius:999px;background:#e5e7eb;color:#4a4a5e;"></span>
        </div>
      </div>
    `;
      const a = e.querySelector('[data-out="n"]'), l = e.querySelector('[data-out="parity"]');
      e.querySelector('[data-act="inc"]').addEventListener("click", () => n((c) => c + 1)), e.querySelector('[data-act="dec"]').addEventListener("click", () => n((c) => c - 1)), Rt(() => {
        a.textContent = `n = ${r()}`;
      }), Rt(() => {
        l.textContent = i();
      });
    });
  });
  function Y(e) {
    return (() => {
      var r = s("column"), n = s("text");
      return m(r, n), t(r, "background", $e), t(r, "cornerRadius", 14), t(r, "padding", 16), t(r, "gap", 12), t(r, "borderWidth", 1), t(r, "borderColor", xe), t(n, "fontSize", 15), t(n, "fontWeight", 800), t(n, "color", Q), B(r, () => e.children, null), G((i) => t(n, "label", e.title, i)), r;
    })();
  }
  function xl(e) {
    const r = ["Inbox", "Starred", "Drafts", "Archive"];
    return [(() => {
      var n = s("column");
      return t(n, "background", Re), t(n, "padding", 16), t(n, "gap", 8), t(n, "height", "fill"), B(n, L(ue, { each: r, children: (i) => (() => {
        var a = s("box"), l = s("text");
        return m(a, l), t(a, "background", $e), t(a, "cornerRadius", 8), t(a, "padding", 12), t(a, "onTap", () => e.router.navigate("detail", { name: i }, { title: i })), t(l, "label", `${i}   \u203A`), t(l, "fontSize", 14), t(l, "color", Q), a;
      })() })), n;
    })(), (() => {
      var n = s("drawer"), i = s("box"), a = s("text");
      return m(n, i), t(n, "background", $e), m(i, a), t(i, "padding", 20), t(i, "background", se), t(a, "label", "Mail"), t(a, "fontSize", 20), t(a, "fontWeight", 800), t(a, "color", "#FFFFFF"), B(n, L(ue, { each: r, children: (l) => (() => {
        var c = s("box"), g = s("text");
        return m(c, g), t(c, "padding", 14), t(g, "label", l), t(g, "fontSize", 14), t(g, "color", Q), c;
      })() }), null), n;
    })()];
  }
  function kl(e) {
    return (() => {
      var r = s("column"), n = s("text"), i = s("text");
      return m(r, n), m(r, i), t(r, "background", Re), t(r, "padding", 16), t(r, "gap", 10), t(r, "height", "fill"), t(n, "fontSize", 20), t(n, "fontWeight", 800), t(n, "color", Q), t(i, "label", "The AppBar's \u2039 back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted \u2014 back is instant, no re-render, scroll preserved."), t(i, "fontSize", 13), t(i, "color", H), G((a) => t(n, "label", e.name, a)), r;
    })();
  }
  var Tl = [se, ke, De, Fe];
  function El() {
    const [e, r] = q(false), [n, i] = q(false), [a, l] = q(false), [c, g] = q(0), [f, _] = q("0, 0"), [S, w] = q(false), [P, p] = q(["Alpha", "Beta", "Gamma"]);
    let I = 3;
    const R = Rn({ gallery: (F) => (() => {
      var z = s("column"), E = s("text"), A = s("row");
      return m(z, E), m(z, A), t(z, "background", Re), t(z, "padding", 16), t(z, "gap", 12), t(z, "height", "fill"), t(E, "label", "Tap a swatch \u2014 it flies to the detail screen."), t(E, "fontSize", 13), t(E, "color", H), t(A, "gap", 12), B(A, L(ue, { each: Tl, children: (h) => (() => {
        var y = s("hero"), $ = s("box");
        return m(y, $), t(y, "tag", `hero-${h}`), t($, "width", 56), t($, "height", 56), t($, "background", h), t($, "cornerRadius", 12), t($, "onTap", () => F.router.navigate("detail", { color: h })), y;
      })() })), z;
    })(), detail: { component: (F) => (() => {
      var z = s("column"), E = s("hero"), A = s("box"), h = s("text");
      return m(z, E), m(z, h), t(z, "background", Re), t(z, "padding", 16), t(z, "gap", 12), t(z, "height", "fill"), m(E, A), t(A, "width", "fill"), t(A, "height", 180), t(A, "cornerRadius", 20), t(h, "label", "The swatch flew here from the gallery \u2014 a shared-element transition, GPU-composited host-side."), t(h, "fontSize", 13), t(h, "color", H), G((y) => {
        var $ = `hero-${F.params.color}`, D = F.params.color;
        return $ !== y.e && (y.e = t(E, "tag", $, y.e)), D !== y.t && (y.t = t(A, "background", D, y.t)), y;
      }, { e: undefined, t: undefined }), z;
    })(), title: "Detail", transition: "fade" } }, "gallery");
    return (() => {
      var F = s("scrollView"), z = s("text"), E = s("text"), A = s("text");
      return m(F, z), m(F, E), m(F, A), t(F, "background", Re), t(F, "padding", 16), t(F, "gap", 14), t(z, "label", "Animations"), t(z, "fontSize", 24), t(z, "fontWeight", 800), t(z, "color", Q), t(E, "label", "Host-side motion \u2014 JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."), t(E, "fontSize", 13), t(E, "color", H), B(F, L(Y, { title: "Implicit hot-prop tween \u2014 the animate prop", get children() {
        return [(() => {
          var h = s("row"), y = s("box");
          return m(h, y), t(h, "gap", 8), t(y, "width", 64), t(y, "height", 64), t(y, "background", se), t(y, "cornerRadius", 14), t(y, "animate", { duration: 450, curve: "easeInOut" }), G(($) => {
            var D = e() ? 0.3 : 1, M = e() ? 1.4 : 1, U = e() ? 1.4 : 1, de = e() ? 0.5 : 0, ce = e() ? 70 : 0;
            return D !== $.e && ($.e = t(y, "opacity", D, $.e)), M !== $.t && ($.t = t(y, "scaleX", M, $.t)), U !== $.a && ($.a = t(y, "scaleY", U, $.a)), de !== $.o && ($.o = t(y, "rotation", de, $.o)), ce !== $.i && ($.i = t(y, "translationX", ce, $.i)), $;
          }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined }), h;
        })(), (() => {
          var h = s("button");
          return t(h, "onClick", () => r(!e())), G((y) => t(h, "label", e() ? "Reset" : "Animate", y)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "opacity + scale + rotation + translation tween together \u2014 JS only flips one signal; the whole tween runs host-side."), t(h, "fontSize", 11), t(h, "color", H), h;
        })()];
      } }), A), B(F, L(Y, { title: "Cold-prop tween \u2014 colour \xB7 radius \xB7 padding", get children() {
        return [(() => {
          var h = s("box"), y = s("text");
          return m(h, y), t(h, "animate", { duration: 400, curve: "easeInOut" }), t(h, "width", "fill"), t(y, "label", "AnimatedContainer tweens these host-side"), t(y, "fontSize", 12), t(y, "color", "#FFFFFFFF"), G(($) => {
            var D = n() ? St : se, M = n() ? 32 : 8, U = n() ? 28 : 12;
            return D !== $.e && ($.e = t(h, "background", D, $.e)), M !== $.t && ($.t = t(h, "cornerRadius", M, $.t)), U !== $.a && ($.a = t(h, "padding", U, $.a)), $;
          }, { e: undefined, t: undefined, a: undefined }), h;
        })(), (() => {
          var h = s("button");
          return t(h, "onClick", () => i(!n())), G((y) => t(h, "label", n() ? "Reset" : "Animate", y)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "background, cornerRadius and padding are cold props \u2014 the host's AnimatedContainer tweens them; JS writes each value once."), t(h, "fontSize", 11), t(h, "color", H), h;
        })()];
      } }), A), B(F, L(Y, { title: "Looping \u2014 repeat \xB7 reverse", get children() {
        return [(() => {
          var h = s("row"), y = s("box"), $ = s("box"), D = s("box");
          return m(h, y), m(h, $), m(h, D), t(h, "gap", 20), t(y, "width", 44), t(y, "height", 44), t(y, "background", Fe), t(y, "cornerRadius", 22), t(y, "animate", { duration: 800, curve: "easeInOut", repeat: true, reverse: true }), t(y, "scaleX", 1.35), t(y, "scaleY", 1.35), t($, "width", 44), t($, "height", 44), t($, "background", ke), t($, "cornerRadius", 10), t($, "animate", { duration: 1400, repeat: true }), t($, "rotation", 6.2832), t(D, "width", 44), t(D, "height", 44), t(D, "background", De), t(D, "cornerRadius", 22), t(D, "animate", { duration: 900, curve: "easeInOut", repeat: true, reverse: true }), t(D, "opacity", 0.25), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "A pulse, a spin and a breathe \u2014 each loops forever host-side; JS set the endpoints once and never touches them again."), t(h, "fontSize", 11), t(h, "color", H), h;
        })()];
      } }), A), B(F, L(Y, { title: "Spring physics \u2014 animate.spring", get children() {
        return [(() => {
          var h = s("column"), y = s("box"), $ = s("box"), D = s("box");
          return m(h, y), m(h, $), m(h, D), t(h, "gap", 10), t(y, "width", 48), t(y, "height", 48), t(y, "background", se), t(y, "cornerRadius", 10), t(y, "animate", { duration: 700, spring: "gentle" }), t($, "width", 48), t($, "height", 48), t($, "background", ke), t($, "cornerRadius", 10), t($, "animate", { duration: 700, spring: "bouncy" }), t(D, "width", 48), t(D, "height", 48), t(D, "background", De), t(D, "cornerRadius", 10), t(D, "animate", { duration: 700, spring: "stiff" }), G((M) => {
            var U = a() ? 150 : 0, de = a() ? 150 : 0, ce = a() ? 150 : 0;
            return U !== M.e && (M.e = t(y, "translationX", U, M.e)), de !== M.t && (M.t = t($, "translationX", de, M.t)), ce !== M.a && (M.a = t(D, "translationX", ce, M.a)), M;
          }, { e: undefined, t: undefined, a: undefined }), h;
        })(), (() => {
          var h = s("button");
          return t(h, "onClick", () => l(!a())), G((y) => t(h, "label", a() ? "Back" : "Spring", y)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "gentle \xB7 bouncy \xB7 stiff \u2014 three spring-like curves; bouncy overshoots and wobbles into place."), t(h, "fontSize", 11), t(h, "color", H), h;
        })()];
      } }), A), B(F, L(Y, { title: "Physics \u2014 real SpringSimulation (spring)", get children() {
        return [(() => {
          var h = s("column"), y = s("box"), $ = s("box"), D = s("box");
          return m(h, y), m(h, $), m(h, D), t(h, "gap", 12), t(y, "width", 52), t(y, "height", 52), t(y, "background", se), t(y, "cornerRadius", 12), t(y, "spring", "gentle"), t($, "width", 52), t($, "height", 52), t($, "background", ke), t($, "cornerRadius", 12), t($, "spring", "bouncy"), t(D, "width", 52), t(D, "height", 52), t(D, "background", De), t(D, "cornerRadius", 12), t(D, "spring", "stiff"), G((M) => {
            var U = c(), de = c(), ce = c();
            return U !== M.e && (M.e = t(y, "translationX", U, M.e)), de !== M.t && (M.t = t($, "translationX", de, M.t)), ce !== M.a && (M.a = t(D, "translationX", ce, M.a)), M;
          }, { e: undefined, t: undefined, a: undefined }), h;
        })(), (() => {
          var h = s("button");
          return t(h, "onClick", () => g(c() === 0 ? 175 : 0)), G((y) => t(h, "label", c() === 0 ? "Spring" : "Back", y)), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "A real SpringSimulation drives these \u2014 not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."), t(h, "fontSize", 11), t(h, "color", H), h;
        })()];
      } }), A), B(F, L(Y, { title: "Physics \u2014 release momentum (draggable + release)", get children() {
        return [(() => {
          var h = s("box"), y = s("box"), $ = s("text");
          return m(h, y), t(h, "height", 150), t(h, "background", Se), t(h, "cornerRadius", 12), m(y, $), t(y, "draggable", true), t(y, "release", "glide"), t(y, "width", 60), t(y, "height", 60), t(y, "background", se), t(y, "cornerRadius", 14), t(y, "onPanEnd", (D, M) => _(`${D.toFixed(0)}, ${M.toFixed(0)}`)), t($, "label", "glide"), t($, "fontSize", 11), t($, "color", "#FFFFFFFF"), h;
        })(), (() => {
          var h = s("text");
          return t(h, "fontSize", 11), t(h, "color", H), G((y) => t(h, "label", `Throw the blue box \u2014 friction carries it on after you let go and decelerates it to rest. Resting at ${f()}.`, y)), h;
        })(), (() => {
          var h = s("box"), y = s("box"), $ = s("text");
          return m(h, y), t(h, "height", 150), t(h, "background", Se), t(h, "cornerRadius", 12), m(y, $), t(y, "draggable", true), t(y, "release", "springBack"), t(y, "width", 60), t(y, "height", 60), t(y, "background", Fe), t(y, "cornerRadius", 14), t($, "label", "spring"), t($, "fontSize", 11), t($, "color", "#FFFFFFFF"), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "Throw the purple box \u2014 a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder \u2192 springs back harder). All host-side: zero per-frame bridge traffic."), t(h, "fontSize", 11), t(h, "color", H), h;
        })()];
      } }), A), B(F, L(Y, { title: "Cross-fade \u2014 CrossFade", get children() {
        return [(() => {
          var h = s("box"), y = s("crossFade");
          return m(h, y), t(h, "height", 92), B(y, (() => {
            var $ = mn(() => !!S());
            return () => $() ? (() => {
              var D = s("box"), M = s("text");
              return m(D, M), t(D, "width", "fill"), t(D, "height", 92), t(D, "background", Fe), t(D, "cornerRadius", 12), t(D, "padding", 16), t(M, "label", "Panel B"), t(M, "fontSize", 16), t(M, "fontWeight", 800), t(M, "color", "#FFFFFFFF"), D;
            })() : (() => {
              var D = s("box"), M = s("text");
              return m(D, M), t(D, "width", "fill"), t(D, "height", 92), t(D, "background", se), t(D, "cornerRadius", 12), t(D, "padding", 16), t(M, "label", "Panel A"), t(M, "fontSize", 16), t(M, "fontWeight", 800), t(M, "color", "#FFFFFFFF"), D;
            })();
          })()), h;
        })(), (() => {
          var h = s("button");
          return t(h, "label", "Swap panel"), t(h, "onClick", () => w(!S())), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "AnimatedSwitcher fades the old child out as the new fades in \u2014 the outgoing element is retained through the fade."), t(h, "fontSize", 11), t(h, "color", H), h;
        })()];
      } }), A), B(F, L(Y, { title: "Animated list \u2014 AnimatedList", get children() {
        return [(() => {
          var h = s("animatedList");
          return t(h, "gap", 8), B(h, L(ue, { get each() {
            return P();
          }, children: (y) => (() => {
            var $ = s("box"), D = s("text");
            return m($, D), t($, "background", Se), t($, "cornerRadius", 8), t($, "padding", 12), t(D, "label", y), t(D, "fontSize", 13), t(D, "color", Q), $;
          })() })), h;
        })(), (() => {
          var h = s("row"), y = s("button"), $ = s("button");
          return m(h, y), m(h, $), t(h, "gap", 8), t(y, "label", "Add"), t(y, "onClick", () => p([...P(), `Item ${++I}`])), t($, "label", "Remove"), t($, "onClick", () => p(P().slice(0, -1))), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "Add \u2192 a row fades + expands in; Remove \u2192 it collapses + fades out. Both host-side, via deferred teardown."), t(h, "fontSize", 11), t(h, "color", H), h;
        })()];
      } }), A), B(F, L(Y, { title: "Shared element \u2014 Hero", get children() {
        return [(() => {
          var h = s("box");
          return t(h, "height", 300), t(h, "borderWidth", 1), t(h, "borderColor", xe), t(h, "cornerRadius", 8), B(h, L(R.View, {})), h;
        })(), (() => {
          var h = s("text");
          return t(h, "label", "A Hero with a matching tag on each screen flies between them across the navigator push \u2014 the navigator is a real Flutter Navigator."), t(h, "fontSize", 11), t(h, "color", H), h;
        })()];
      } }), A), t(A, "label", "\u2014 end of animations \u2014"), t(A, "fontSize", 12), t(A, "color", H), F;
    })();
  }
  function Rl() {
    const [e, r] = q("material"), [n, i] = q(false), [a, l] = q(true), [c, g] = q(false), [f, _] = q(40), [S, w] = q(""), [P, p] = q("none yet"), [I, R] = q(0), [F, z] = q(["Item one", "Item two", "Item three", "Item four"]);
    let E = 0;
    const [A, h] = q([]), [y, $] = q([]), [D, M] = q("M"), [U, de] = q([]), [ce, le] = q(0), [Be, pe] = q(false), [Pe, or] = q(0), [ar, zn] = q(0), [Xe, Ln] = q(false), [Mn, Te] = q("\u2014"), [sr, lr] = q("0, 0"), [Bn, cr] = q("\u2014"), [xt, ur] = q(1);
    let Ne = 1;
    const [Nn, kt] = q("\u2014 try a dialog button \u2014"), [rt, dt] = q("\u2014 no date / time picked \u2014"), [Nt, Wn] = q(["First item", "Second item", "Third item", "Fourth item"]), Hn = Rn({ list: { component: (T) => L(xl, { get router() {
      return T.router;
    } }), title: "Mailboxes" }, detail: (T) => L(kl, { get name() {
      return T.params.name;
    }, get router() {
      return T.router;
    } }) }, "list"), [fr, zr] = q(0), Tt = (T, b) => {
      r(T), i(b), Sa(T, b ? 1 : 0);
    }, Lr = Rn({ home: { component: (T) => Vn(T.router) }, animations: { component: () => L(El, {}), title: "Animations" } }, "home");
    function Vn(T) {
      return (() => {
        var b = s("scrollView"), O = s("text"), C = s("text"), k = s("text");
        return m(b, O), m(b, C), m(b, k), t(b, "background", Re), t(b, "padding", 16), t(b, "gap", 14), t(b, "scrollbar", true), t(O, "label", "Skal \u2014 Component Demo"), t(O, "testID", "home-title"), t(O, "fontSize", 24), t(O, "fontWeight", 800), t(O, "color", Q), t(C, "label", "Every fast-path widget, plus animation, the design system, and dialogs."), t(C, "fontSize", 13), t(C, "color", H), B(b, L(Y, { title: "Design system \u2014 setDesign()", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "fontSize", 13), t(o, "color", H), G((u) => t(o, "label", `active: ${e()} \xB7 ${n() ? "dark" : "light"}`, u)), o;
          })(), (() => {
            var o = s("wrap"), u = s("button"), d = s("button"), v = s("button");
            return m(o, u), m(o, d), m(o, v), t(o, "gap", 8), t(u, "label", "Material"), t(u, "onClick", () => Tt("material", n())), t(d, "label", "Cupertino"), t(d, "onClick", () => Tt("cupertino", n())), t(v, "onClick", () => Tt(e(), !n())), G((x) => t(v, "label", n() ? "Light mode" : "Dark mode", x)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Buttons, switches, sliders, the text field & spinner all swap Material\u2194Cupertino."), t(o, "fontSize", 11), t(o, "color", H), o;
          })()];
        } }), k), B(b, L(Y, { title: "Layout \u2014 box \xB7 row \xB7 wrap", get children() {
          return [(() => {
            var o = s("row"), u = s("box"), d = s("box"), v = s("box");
            return m(o, u), m(o, d), m(o, v), t(o, "gap", 8), t(u, "width", 56), t(u, "height", 56), t(u, "background", se), t(u, "cornerRadius", 10), t(d, "width", 56), t(d, "height", 56), t(d, "background", ke), t(d, "cornerRadius", 10), t(v, "width", 56), t(v, "height", 56), t(v, "background", De), t(v, "cornerRadius", 10), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Wrap \u2014 children flow onto new runs:"), t(o, "fontSize", 11), t(o, "color", H), o;
          })(), (() => {
            var o = s("wrap");
            return t(o, "gap", 6), B(o, L(ue, { each: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"], children: (u) => (() => {
              var d = s("box"), v = s("text");
              return m(d, v), t(d, "background", Se), t(d, "cornerRadius", 12), t(d, "paddingLeft", 10), t(d, "paddingRight", 10), t(d, "paddingTop", 6), t(d, "paddingBottom", 6), t(v, "label", u), t(v, "fontSize", 12), t(v, "color", Q), d;
            })() })), o;
          })()];
        } }), k), B(b, L(Y, { title: "Stack \u2014 overlap + positioned children", get children() {
          var o = s("stack"), u = s("box"), d = s("box"), v = s("text"), x = s("box");
          return m(o, u), m(o, d), m(o, x), t(o, "width", "fill"), t(o, "height", 120), t(u, "width", "fill"), t(u, "height", 120), t(u, "background", Fe), t(u, "cornerRadius", 12), m(d, v), t(d, "top", 10), t(d, "left", 10), t(d, "background", $e), t(d, "cornerRadius", 8), t(d, "paddingLeft", 10), t(d, "paddingRight", 10), t(d, "paddingTop", 4), t(d, "paddingBottom", 4), t(v, "label", "top \xB7 left"), t(v, "fontSize", 11), t(v, "color", Q), t(x, "bottom", 10), t(x, "right", 10), t(x, "width", 30), t(x, "height", 30), t(x, "background", St), t(x, "cornerRadius", 15), o;
        } }), k), B(b, L(Y, { title: "Text & RichText", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Styled text \u2014 18sp, weight 700."), t(o, "fontSize", 18), t(o, "fontWeight", 700), t(o, "color", Q), o;
          })(), (() => {
            var o = s("richText"), u = s("text"), d = s("text"), v = s("text"), x = s("text"), N = s("text");
            return m(o, u), m(o, d), m(o, v), m(o, x), m(o, N), t(u, "label", "Rich text "), t(u, "fontSize", 16), t(u, "color", Q), t(d, "label", "mixes "), t(d, "fontSize", 16), t(d, "color", se), t(d, "fontWeight", 800), t(v, "label", "size, "), t(v, "fontSize", 22), t(v, "color", St), t(v, "fontWeight", 700), t(x, "label", "weight "), t(x, "fontSize", 16), t(x, "color", ke), t(x, "fontWeight", 800), t(N, "label", "and colour inline."), t(N, "fontSize", 16), t(N, "color", Q), o;
          })()];
        } }), k), B(b, L(Y, { title: "Image \u2014 network \xB7 BoxFit \xB7 rounded", get children() {
          return [(() => {
            var o = s("image");
            return t(o, "src", "https://picsum.photos/seed/skal/640/360"), t(o, "width", "fill"), t(o, "height", 160), t(o, "contentScale", 1), t(o, "cornerRadius", 12), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "contentScale=1 (cover); cornerRadius clips the pixels. Requires network."), t(o, "fontSize", 11), t(o, "color", H), o;
          })()];
        } }), k), B(b, L(Y, { title: "Scrolling \u2014 horizontal list \xB7 lazy grid \xB7 reorderable", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "listView axis=1 (horizontal, virtualized):"), t(o, "fontSize", 11), t(o, "color", H), o;
          })(), (() => {
            var o = s("listView");
            return t(o, "axis", 1), t(o, "height", 66), t(o, "gap", 8), B(o, L(ue, { each: [se, ke, De, Fe, St, "#FF00C7BE", "#FFAF52DE", "#FFFFD60A"], children: (u) => (() => {
              var d = s("box");
              return t(d, "width", 66), t(d, "height", 50), t(d, "background", u), t(d, "cornerRadius", 10), d;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "lazyGrid \u2014 crossAxisCount=4:"), t(o, "fontSize", 11), t(o, "color", H), o;
          })(), (() => {
            var o = s("lazyGrid");
            return t(o, "crossAxisCount", 4), t(o, "aspectRatio", 1), t(o, "gap", 8), t(o, "height", 150), B(o, L(ue, { get each() {
              return Array.from({ length: 12 }, (u, d) => d);
            }, children: (u) => (() => {
              var d = s("box");
              return t(d, "background", u % 3 === 0 ? se : u % 3 === 1 ? ke : De), t(d, "cornerRadius", 8), d;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "reorderableListView \u2014 drag a row to reorder:"), t(o, "fontSize", 11), t(o, "color", H), o;
          })(), (() => {
            var o = s("reorderableListView");
            return t(o, "height", 200), t(o, "gap", 6), t(o, "onReorder", (u, d) => {
              const v = Nt().slice(), [x] = v.splice(u, 1);
              v.splice(d, 0, x), Wn(v);
            }), B(o, L(ue, { get each() {
              return Nt();
            }, children: (u) => (() => {
              var d = s("box"), v = s("text");
              return m(d, v), t(d, "background", Se), t(d, "cornerRadius", 8), t(d, "padding", 12), t(v, "label", u), t(v, "fontSize", 13), t(v, "color", Q), d;
            })() })), o;
          })()];
        } }), k), B(b, L(Y, { title: "Controls \u2014 switch \xB7 checkbox \xB7 slider \xB7 text field", get children() {
          return [(() => {
            var o = s("row"), u = s("switch"), d = s("text");
            return m(o, u), m(o, d), t(o, "gap", 12), t(u, "onChange", (v) => l(v)), t(d, "fontSize", 13), t(d, "color", Q), G((v) => {
              var x = a(), N = a() ? "switch: on" : "switch: off";
              return x !== v.e && (v.e = t(u, "checked", x, v.e)), N !== v.t && (v.t = t(d, "label", N, v.t)), v;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = s("row"), u = s("checkbox"), d = s("text");
            return m(o, u), m(o, d), t(o, "gap", 12), t(u, "onChange", (v) => g(v)), t(d, "fontSize", 13), t(d, "color", Q), G((v) => {
              var x = c(), N = c() ? "checkbox: checked" : "checkbox: unchecked";
              return x !== v.e && (v.e = t(u, "checked", x, v.e)), N !== v.t && (v.t = t(d, "label", N, v.t)), v;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = s("slider");
            return t(o, "min", 0), t(o, "max", 100), t(o, "onChange", (u) => _(u)), G((u) => t(o, "value", f(), u)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 13), t(o, "color", Q), G((u) => t(o, "label", `slider: ${Math.round(f())}`, u)), o;
          })(), (() => {
            var o = s("textInput");
            return t(o, "placeholder", "Type your name\u2026"), t(o, "onChange", (u) => w(u)), t(o, "onSubmit", (u) => Pi(`Submitted: ${u}`)), G((u) => t(o, "value", S(), u)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 13), t(o, "color", H), G((u) => t(o, "label", S() ? `Hello, ${S()}!` : "\u2014 type above; press Enter to submit \u2014", u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "Indicators \u2014 spinner \xB7 progress bar", get children() {
          return [(() => {
            var o = s("row"), u = s("activityIndicator"), d = s("text");
            return m(o, u), m(o, d), t(o, "gap", 12), t(u, "color", se), t(d, "label", "CircularProgressIndicator"), t(d, "fontSize", 13), t(d, "color", Q), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "determinate \u2014 tracks the slider above:"), t(o, "fontSize", 11), t(o, "color", H), o;
          })(), (() => {
            var o = s("progressBar");
            return t(o, "color", se), G((u) => t(o, "progress", f() / 100, u)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "indeterminate:"), t(o, "fontSize", 11), t(o, "color", H), o;
          })(), (() => {
            var o = s("progressBar");
            return t(o, "color", ke), o;
          })()];
        } }), k), B(b, L(Y, { title: "Animation", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Implicit tweens, looping, list enter/exit, Hero \u2014 all host-side, zero per-frame bridge traffic. Opens a dedicated page."), t(o, "fontSize", 11), t(o, "color", H), o;
          })(), (() => {
            var o = s("button");
            return t(o, "label", "Open Animations \u2192"), t(o, "onClick", () => T.navigate("animations")), o;
          })()];
        } }), k), B(b, L(Y, { title: "ListTile \u2014 structured rows", get children() {
          return [(() => {
            var o = s("box"), u = s("column"), d = s("listTile"), v = s("listTile"), x = s("listTile");
            return m(o, u), t(o, "background", $e), t(o, "cornerRadius", 12), t(o, "borderWidth", 1), t(o, "borderColor", xe), m(u, d), m(u, v), m(u, x), t(u, "padding", 0), t(u, "gap", 0), t(d, "leadingIcon", "person"), t(d, "title", "Profile"), t(d, "subtitle", "Name, photo, bio"), t(d, "trailingIcon", "explore"), t(d, "onClick", () => p("tapped Profile")), t(v, "leadingIcon", "bell"), t(v, "title", "Notifications"), t(v, "subtitle", "Sounds, badges, alerts"), t(v, "trailingIcon", "explore"), t(v, "onClick", () => p("tapped Notifications")), t(x, "leadingIcon", "settings"), t(x, "title", "Settings"), t(x, "trailingIcon", "explore"), t(x, "onClick", () => p("tapped Settings")), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", H), G((u) => t(o, "label", `last row: ${P()}`, u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "PageView \u2014 swipe between pages", get children() {
          return [(() => {
            var o = s("box"), u = s("pageView"), d = s("box"), v = s("text"), x = s("box"), N = s("text"), X = s("box"), K = s("text");
            return m(o, u), t(o, "height", 140), m(u, d), m(u, x), m(u, X), t(u, "onChange", (j) => R(j)), m(d, v), t(d, "width", "fill"), t(d, "height", 140), t(d, "background", se), t(d, "cornerRadius", 12), t(d, "padding", 20), t(v, "label", "Page 1 \u2014 swipe \u2192"), t(v, "fontSize", 16), t(v, "fontWeight", 800), t(v, "color", "#FFFFFFFF"), m(x, N), t(x, "width", "fill"), t(x, "height", 140), t(x, "background", ke), t(x, "cornerRadius", 12), t(x, "padding", 20), t(N, "label", "Page 2"), t(N, "fontSize", 16), t(N, "fontWeight", 800), t(N, "color", "#FFFFFFFF"), m(X, K), t(X, "width", "fill"), t(X, "height", 140), t(X, "background", De), t(X, "cornerRadius", 12), t(X, "padding", 20), t(K, "label", "Page 3"), t(K, "fontSize", 16), t(K, "fontWeight", 800), t(K, "color", "#FFFFFFFF"), G((j) => t(u, "activeTab", I(), j)), o;
          })(), (() => {
            var o = s("row"), u = s("button"), d = s("button");
            return m(o, u), m(o, d), t(o, "gap", 8), t(u, "label", "\u25C0 Prev"), t(u, "onClick", () => R(Math.max(0, I() - 1))), t(d, "label", "Next \u25B6"), t(d, "onClick", () => R(Math.min(2, I() + 1))), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", H), G((u) => t(o, "label", `page ${I() + 1} of 3 \u2014 swipe or use the buttons`, u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "Pull-to-refresh + swipe-to-dismiss", get children() {
          return [(() => {
            var o = s("box"), u = s("listView");
            return m(o, u), t(o, "height", 210), t(o, "borderWidth", 1), t(o, "borderColor", xe), t(o, "cornerRadius", 8), t(u, "onRefresh", async () => {
              await new Promise((d) => setTimeout(d, 900)), z([`Fresh item ${++E}`, ...F()]);
            }), B(u, L(ue, { get each() {
              return F();
            }, children: (d) => (() => {
              var v = s("dismissible"), x = s("box"), N = s("text");
              return m(v, x), t(v, "onDismiss", () => z(F().filter((X) => X !== d))), m(x, N), t(x, "width", "fill"), t(x, "background", Se), t(x, "cornerRadius", 8), t(x, "padding", 14), t(N, "label", d), t(N, "fontSize", 13), t(N, "color", Q), v;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Pull the list down to refresh (a 900ms async task \u2014 the spinner waits for it); swipe any row sideways to dismiss it."), t(o, "fontSize", 11), t(o, "color", H), o;
          })()];
        } }), k), B(b, L(Y, { title: "Slivers \u2014 collapsing header (CustomScrollView)", get children() {
          return [(() => {
            var o = s("box"), u = s("customScrollView"), d = s("sliverAppBar"), v = s("box"), x = s("text"), N = s("sliverList"), X = s("sliverGrid");
            return m(o, u), t(o, "height", 340), t(o, "borderWidth", 1), t(o, "borderColor", xe), t(o, "cornerRadius", 8), m(u, d), m(u, N), m(u, X), m(d, v), t(d, "title", "Collapsing header"), t(d, "height", 170), t(d, "sliverMode", "pinned"), t(d, "background", se), m(v, x), t(v, "width", "fill"), t(v, "height", 170), t(v, "background", Fe), t(v, "padding", 20), t(x, "label", "Parallax background"), t(x, "fontSize", 18), t(x, "fontWeight", 800), t(x, "color", "#FFFFFFFF"), B(N, L(ue, { each: ["One", "Two", "Three", "Four", "Five"], children: (K) => (() => {
              var j = s("box"), Z = s("text");
              return m(j, Z), t(j, "width", "fill"), t(j, "background", $e), t(j, "padding", 16), t(j, "borderWidth", 1), t(j, "borderColor", xe), t(Z, "label", `Row ${K}`), t(Z, "fontSize", 14), t(Z, "color", Q), j;
            })() })), t(X, "crossAxisCount", 3), t(X, "aspectRatio", 1), t(X, "gap", 8), B(X, L(ue, { each: [se, ke, De, Fe, St, se, ke, De, Fe], children: (K) => (() => {
              var j = s("box");
              return t(j, "background", K), t(j, "cornerRadius", 10), j;
            })() })), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Scroll the panel up \u2014 the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."), t(o, "fontSize", 11), t(o, "color", H), o;
          })()];
        } }), k), B(b, L(Y, { title: "Canvas \u2014 CustomPaint 2-D drawing", get children() {
          return [(() => {
            var o = s("box"), u = s("canvas");
            return m(o, u), t(o, "background", $e), t(o, "cornerRadius", 12), t(o, "borderWidth", 1), t(o, "borderColor", xe), t(o, "padding", 10), t(u, "width", 300), t(u, "height", 170), t(u, "draw", (d) => {
              d.strokeStyle(xe).lineWidth(2).beginPath().moveTo(16, 150).lineTo(284, 150).stroke(), [50, 95, 70, f() + 10, 80].forEach((v, x) => {
                d.fillStyle(x === 3 ? se : Fe).fillRect(28 + x * 52, 150 - v, 34, v);
              }), d.fillStyle(ke).beginPath().circle(252, 44, 22).fill(), d.fillStyle(Q).fontSize(12).fillText("bars \xB7 circle \xB7 path \xB7 text", 18, 22), A().forEach((v) => {
                d.fillStyle(v.color).beginPath().circle(v.x, v.y, v.r).fill();
              });
            }), o;
          })(), (() => {
            var o = s("row"), u = s("button"), d = s("button");
            return m(o, u), m(o, d), t(o, "gap", 8), t(u, "label", "Draw a shape"), t(u, "onClick", () => h([...A(), { x: 24 + Math.random() * 252, y: 16 + Math.random() * 120, r: 8 + Math.random() * 20, color: [se, ke, De, St, Fe][Math.floor(Math.random() * 5)] }])), t(d, "label", "Clear"), t(d, "onClick", () => h([])), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Bars, a circle, a stroked path, text. The 4th bar tracks the Controls slider; the buttons append/clear circles \u2014 each click flips the canvasShapes signal, so the draw callback re-records and the host repaints. Static drawings cross the bridge exactly once."), t(o, "fontSize", 11), t(o, "color", H), o;
          })()];
        } }), k), B(b, L(Y, { title: "Drag-and-drop \u2014 DragItem onto DropZone", get children() {
          return [(() => {
            var o = s("row");
            return t(o, "gap", 8), B(o, L(ue, { each: ["Apple", "Banana", "Cherry"], children: (u) => (() => {
              var d = s("dragItem"), v = s("box"), x = s("text");
              return m(d, v), t(d, "dragData", u), m(v, x), t(v, "background", Fe), t(v, "cornerRadius", 20), t(v, "padding", 12), t(x, "label", u), t(x, "fontSize", 13), t(x, "color", "#FFFFFFFF"), d;
            })() })), o;
          })(), (() => {
            var o = s("dropZone"), u = s("box"), d = s("text");
            return m(o, u), t(o, "onDrop", (v) => $([...y(), v])), m(u, d), t(u, "width", "fill"), t(u, "height", 90), t(u, "background", Se), t(u, "cornerRadius", 12), t(u, "padding", 16), t(d, "fontSize", 13), t(d, "color", Q), G((v) => t(d, "label", y().length ? `Basket: ${y().join(", ")}` : "Drag a chip into this zone", v)), o;
          })(), (() => {
            var o = s("row"), u = s("button");
            return m(o, u), t(o, "gap", 8), t(u, "label", "Clear basket"), t(u, "onClick", () => $([])), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Drag a fruit chip onto the zone \u2014 it highlights host-side while you hover; on release onDrop fires with the chip's dragData string. The whole drag is host-side; only the drop crosses the bridge."), t(o, "fontSize", 11), t(o, "color", H), o;
          })()];
        } }), k), B(b, L(Y, { title: "More controls \u2014 radio \xB7 chip \xB7 segmented \xB7 accordion", get children() {
          return [(() => {
            var o = s("row");
            return t(o, "gap", 16), B(o, L(ue, { each: ["S", "M", "L"], children: (u) => (() => {
              var d = s("row"), v = s("radio"), x = s("text");
              return m(d, v), m(d, x), t(d, "gap", 2), t(v, "onChange", () => M(u)), t(x, "label", u), t(x, "fontSize", 13), t(x, "color", Q), G((N) => t(v, "checked", D() === u, N)), d;
            })() })), o;
          })(), (() => {
            var o = s("row");
            return t(o, "gap", 8), B(o, L(ue, { each: ["Red", "Green", "Blue"], children: (u) => (() => {
              var d = s("chip");
              return t(d, "label", u), t(d, "onChange", (v) => de(v ? [...U(), u] : U().filter((x) => x !== u))), G((v) => t(d, "checked", U().includes(u), v)), d;
            })() })), o;
          })(), (() => {
            var o = s("segmentedButton"), u = s("text"), d = s("text"), v = s("text");
            return m(o, u), m(o, d), m(o, v), t(o, "onChange", (x) => le(x)), t(u, "label", "Day"), t(u, "fontSize", 13), t(d, "label", "Week"), t(d, "fontSize", 13), t(v, "label", "Month"), t(v, "fontSize", 13), G((x) => t(o, "activeTab", ce(), x)), o;
          })(), (() => {
            var o = s("row"), u = s("text"), d = s("dropdown"), v = s("text"), x = s("text"), N = s("text");
            return m(o, u), m(o, d), t(o, "gap", 8), t(u, "label", "Priority"), t(u, "fontSize", 13), t(u, "color", Q), m(d, v), m(d, x), m(d, N), t(d, "onChange", (X) => or(X)), t(v, "label", "Low"), t(v, "fontSize", 13), t(x, "label", "Medium"), t(x, "fontSize", 13), t(N, "label", "High"), t(N, "fontSize", 13), G((X) => t(d, "activeTab", Pe(), X)), o;
          })(), (() => {
            var o = s("box"), u = s("expansionTile"), d = s("box"), v = s("text");
            return m(o, u), t(o, "background", $e), t(o, "cornerRadius", 8), t(o, "borderWidth", 1), t(o, "borderColor", xe), m(u, d), t(u, "title", "Details"), t(u, "onChange", (x) => pe(x)), m(d, v), t(d, "padding", 14), t(d, "background", Se), t(v, "label", "Body content revealed by the accordion \u2014 host-owned open state, host-side expand animation."), t(v, "fontSize", 12), t(v, "color", H), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", H), G((u) => t(o, "label", `size ${D()} \xB7 chips ${U().join("/") || "\u2014"} \xB7 segment ${["Day", "Week", "Month"][ce()]} \xB7 priority ${["Low", "Medium", "High"][Pe()]} \xB7 details ${Be() ? "open" : "closed"}`, u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "Stepper \u2014 multi-step flow", get children() {
          return [(() => {
            var o = s("stepper"), u = s("step"), d = s("text"), v = s("step"), x = s("text"), N = s("step"), X = s("text");
            return m(o, u), m(o, v), m(o, N), t(o, "onChange", (K) => zn(K)), m(u, d), t(u, "title", "Account"), t(d, "label", "Create your account \u2014 name, email, password."), t(d, "fontSize", 12), t(d, "color", H), m(v, x), t(v, "title", "Profile"), t(x, "label", "Add a photo and a short bio."), t(x, "fontSize", 12), t(x, "color", H), m(N, X), t(N, "title", "Done"), t(X, "label", "All set \u2014 review and finish."), t(X, "fontSize", 12), t(X, "color", H), G((K) => t(o, "activeTab", ar(), K)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", H), G((u) => t(o, "label", `current step: ${ar() + 1} of 3`, u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "BottomSheet \u2014 draggable / expandable", get children() {
          var o = s("box"), u = s("stack"), d = s("box"), v = s("text"), x = s("bottomSheet"), N = s("box"), X = s("text");
          return m(o, u), t(o, "height", 300), t(o, "cornerRadius", 12), t(o, "background", Se), m(u, d), m(u, x), m(d, v), t(d, "width", "fill"), t(d, "height", "fill"), t(d, "padding", 16), t(v, "label", "A DraggableScrollableSheet \u2014 drag the sheet up, or scroll its list past the edge to expand it."), t(v, "fontSize", 12), t(v, "color", H), m(x, N), t(x, "initialSize", 0.4), t(x, "minSize", 0.18), t(x, "maxSize", 0.95), t(x, "background", $e), m(N, X), t(N, "padding", 16), t(X, "label", "Sheet content \u2014 drag or scroll"), t(X, "fontSize", 15), t(X, "fontWeight", 700), t(X, "color", Q), B(x, L(ue, { each: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"], children: (K) => (() => {
            var j = s("box"), Z = s("text");
            return m(j, Z), t(j, "padding", 14), t(Z, "label", K), t(Z, "fontSize", 14), t(Z, "color", Q), j;
          })() }), null), o;
        } }), k), B(b, L(Y, { title: "Effects \u2014 BackdropFilter \xB7 InteractiveViewer", get children() {
          return [(() => {
            var o = s("stack"), u = s("image"), d = s("box"), v = s("backdropFilter"), x = s("box");
            return m(o, u), m(o, d), t(u, "src", "https://picsum.photos/seed/skalblur/300/160"), t(u, "width", 300), t(u, "height", 160), t(u, "contentScale", 1), t(u, "cornerRadius", 10), m(d, v), t(d, "top", 0), t(d, "left", 150), t(d, "width", 150), t(d, "height", 160), m(v, x), t(v, "blurRadius", 12), t(x, "width", 150), t(x, "height", 160), t(x, "background", "#33FFFFFF"), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "The right half is frosted by a BackdropFilter."), t(o, "fontSize", 11), t(o, "color", H), o;
          })(), (() => {
            var o = s("box"), u = s("interactiveViewer"), d = s("image");
            return m(o, u), t(o, "height", 200), t(o, "cornerRadius", 12), t(o, "background", Se), m(u, d), t(u, "minScale", 1), t(u, "maxScale", 4), t(d, "src", "https://picsum.photos/seed/skalzoom/320/200"), t(d, "width", 320), t(d, "height", 200), t(d, "contentScale", 1), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Pinch / scroll-wheel to zoom the image, drag to pan."), t(o, "fontSize", 11), t(o, "color", H), o;
          })()];
        } }), k), B(b, L(Y, { title: "Hover \u2014 onHover \xB7 semanticLabel", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return m(o, u), t(o, "padding", 16), t(o, "cornerRadius", 10), t(o, "borderWidth", 1), t(o, "borderColor", xe), t(o, "onHover", (d) => Ln(d)), t(o, "semanticLabel", "A hoverable demo card"), t(u, "fontSize", 14), G((d) => {
              var v = Xe() ? se : $e, x = Xe() ? "Hovering \u2014 pointer is over the card" : "Move the pointer over this card", N = Xe() ? "#FFFFFF" : Q;
              return v !== d.e && (d.e = t(o, "background", v, d.e)), x !== d.t && (d.t = t(u, "label", x, d.t)), N !== d.a && (d.a = t(u, "color", N, d.a)), d;
            }, { e: undefined, t: undefined, a: undefined }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "onHover fires on pointer enter/exit (desktop/web). semanticLabel wraps the card in a Semantics node for screen readers."), t(o, "fontSize", 11), t(o, "color", H), o;
          })()];
        } }), k), B(b, L(Y, { title: "Keyboard \u2014 onKey", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return m(o, u), t(o, "padding", 16), t(o, "cornerRadius", 10), t(o, "background", $e), t(o, "borderWidth", 1), t(o, "borderColor", xe), t(o, "onKey", (d) => Te(d)), t(u, "fontSize", 14), t(u, "color", Q), G((d) => t(u, "label", `last key: ${Mn()}`, d)), o;
          })(), (() => {
            var o = s("text");
            return t(o, "label", "Click the card to focus it, then press keys (\u2318S, Escape, arrows). onKey reports a normalized combo string; build any shortcut layer on it."), t(o, "fontSize", 11), t(o, "color", H), o;
          })()];
        } }), k), B(b, L(Y, { title: "Gestures \u2014 onTap \xB7 onLongPress \xB7 onDoubleTap", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return m(o, u), t(o, "background", Se), t(o, "cornerRadius", 12), t(o, "padding", 22), t(o, "onTap", () => p("onTap")), t(o, "onLongPress", () => p("onLongPress")), t(o, "onDoubleTap", () => p("onDoubleTap")), t(u, "label", "Tap / long-press / double-tap this box"), t(u, "fontSize", 13), t(u, "color", Q), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 12), t(o, "color", H), G((u) => t(o, "label", `last gesture: ${P()}`, u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "Drag \u2014 draggable (zero per-frame bridge traffic)", get children() {
          return [(() => {
            var o = s("box"), u = s("box"), d = s("text");
            return m(o, u), t(o, "height", 150), t(o, "background", Se), t(o, "cornerRadius", 12), m(u, d), t(u, "draggable", true), t(u, "width", 64), t(u, "height", 64), t(u, "background", se), t(u, "cornerRadius", 14), t(u, "onPanEnd", (v, x) => lr(`${v.toFixed(0)}, ${x.toFixed(0)}`)), t(d, "label", "drag"), t(d, "fontSize", 12), t(d, "color", "#FFFFFFFF"), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", H), G((u) => t(o, "label", `Drag the blue box \u2014 the host moves it itself, no event per frame. Resting offset: ${sr()}`, u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "Pan \u2014 onPanUpdate delta stream", get children() {
          return [(() => {
            var o = s("box"), u = s("text");
            return m(o, u), t(o, "height", 70), t(o, "background", Se), t(o, "cornerRadius", 12), t(o, "padding", 16), t(o, "onPanStart", () => cr("drag started")), t(o, "onPanUpdate", (d, v) => cr(`dx ${d.toFixed(1)}  dy ${v.toFixed(1)}`)), t(o, "onPanEnd", (d, v) => cr(`fling v ${d.toFixed(0)}, ${v.toFixed(0)} dp/s`)), t(u, "label", "Drag anywhere on this strip"), t(u, "fontSize", 13), t(u, "color", Q), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", H), G((u) => t(o, "label", `onPanUpdate: ${Bn()}`, u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "Scale \u2014 onScaleUpdate (pinch / rotate)", get children() {
          return [(() => {
            var o = s("box"), u = s("box"), d = s("text");
            return m(o, u), t(o, "height", 170), t(o, "background", Se), t(o, "cornerRadius", 12), m(u, d), t(u, "width", 96), t(u, "height", 96), t(u, "background", Fe), t(u, "cornerRadius", 16), t(u, "onScaleStart", () => {
              Ne = xt();
            }), t(u, "onScaleUpdate", (v) => ur(Math.max(0.3, Ne * v))), t(d, "label", "pinch"), t(d, "fontSize", 13), t(d, "color", "#FFFFFFFF"), G((v) => {
              var x = xt(), N = xt();
              return x !== v.e && (v.e = t(u, "scaleX", x, v.e)), N !== v.t && (v.t = t(u, "scaleY", N, v.t)), v;
            }, { e: undefined, t: undefined }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 11), t(o, "color", H), G((u) => t(o, "label", `Pinch the purple box (two pointers / trackpad). Scale \xD7${xt().toFixed(2)}`, u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "Dialogs \u2014 imperative JS API", get children() {
          return [(() => {
            var o = s("row"), u = s("button"), d = s("button");
            return m(o, u), m(o, d), t(o, "gap", 8), t(u, "label", "Alert"), t(u, "onClick", async () => {
              await $i({ title: "Heads up", message: "A plain alert dialog.", actions: [{ label: "OK", value: "ok" }] }), kt("alert: dismissed");
            }), t(d, "label", "Confirm"), t(d, "onClick", async () => {
              kt(`confirm \u2192 ${await $i({ title: "Delete file?", message: "This cannot be undone.", actions: [{ label: "Cancel", value: "cancel" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "dismissed"}`);
            }), o;
          })(), (() => {
            var o = s("row"), u = s("button"), d = s("button");
            return m(o, u), m(o, d), t(o, "gap", 8), t(u, "label", "Action sheet"), t(u, "onClick", async () => {
              kt(`sheet \u2192 ${await Ta({ title: "Choose an action", actions: [{ label: "Copy", value: "copy" }, { label: "Share", value: "share" }, { label: "Delete", value: "delete", style: "destructive" }] }) ?? "cancelled"}`);
            }), t(d, "label", "Snackbar"), t(d, "onClick", () => {
              Pi("Hello from a snackbar \uD83D\uDC4B"), kt("snackbar: shown");
            }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 12), t(o, "color", H), G((u) => t(o, "label", Nn(), u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "Pickers \u2014 date \xB7 time", get children() {
          return [(() => {
            var o = s("row"), u = s("button"), d = s("button");
            return m(o, u), m(o, d), t(o, "gap", 8), t(u, "label", "Pick a date"), t(u, "onClick", async () => {
              dt(`date \u2192 ${await Ea({ initialDate: "2026-05-17" }) ?? "dismissed"}`);
            }), t(d, "label", "Pick a time"), t(d, "onClick", async () => {
              dt(`time \u2192 ${await Ra({ initialHour: 9, initialMinute: 30 }) ?? "dismissed"}`);
            }), o;
          })(), (() => {
            var o = s("text");
            return t(o, "fontSize", 12), t(o, "color", H), G((u) => t(o, "label", rt(), u)), o;
          })()];
        } }), k), B(b, L(Y, { title: "Navigation \u2014 push / pop with keep-alive", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."), t(o, "fontSize", 11), t(o, "color", H), o;
          })(), (() => {
            var o = s("box");
            return t(o, "height", 320), t(o, "borderWidth", 1), t(o, "borderColor", xe), B(o, L(Hn.View, {})), o;
          })()];
        } }), k), B(b, L(Y, { title: "Tabs \u2014 bottom bar with keep-alive", get children() {
          return [(() => {
            var o = s("text");
            return t(o, "label", "Every tab subtree is built once and kept alive (IndexedStack) \u2014 switching never re-mounts; scroll & state survive."), t(o, "fontSize", 11), t(o, "color", H), o;
          })(), (() => {
            var o = s("box"), u = s("tabs"), d = s("tab"), v = s("column"), x = s("text"), N = s("text"), X = s("tab"), K = s("column"), j = s("text"), Z = s("textInput"), oe = s("tab"), re = s("column"), ye = s("text"), Ce = s("text");
            return m(o, u), t(o, "height", 280), t(o, "borderWidth", 1), t(o, "borderColor", xe), t(o, "cornerRadius", 8), m(u, d), m(u, X), m(u, oe), t(u, "onChange", zr), t(u, "height", "fill"), m(d, v), t(d, "title", "Home"), t(d, "icon", "home"), m(v, x), m(v, N), t(v, "background", Re), t(v, "padding", 16), t(v, "gap", 8), t(v, "height", "fill"), t(x, "label", "Home"), t(x, "fontSize", 20), t(x, "fontWeight", 800), t(x, "color", Q), t(N, "label", "Switch tabs and come back \u2014 this tab was never torn down."), t(N, "fontSize", 13), t(N, "color", H), m(X, K), t(X, "title", "Search"), t(X, "icon", "search"), m(K, j), m(K, Z), t(K, "background", Re), t(K, "padding", 16), t(K, "gap", 8), t(K, "height", "fill"), t(j, "label", "Search"), t(j, "fontSize", 20), t(j, "fontWeight", 800), t(j, "color", Q), t(Z, "placeholder", "Type to search\u2026"), m(oe, re), t(oe, "title", "Profile"), t(oe, "icon", "person"), m(re, ye), m(re, Ce), t(re, "background", Re), t(re, "padding", 16), t(re, "gap", 8), t(re, "height", "fill"), t(ye, "label", "Profile"), t(ye, "fontSize", 20), t(ye, "fontWeight", 800), t(ye, "color", Q), t(Ce, "fontSize", 13), t(Ce, "color", H), G((Ke) => {
              var Eo = fr(), Ro = `active tab index: ${fr()}`;
              return Eo !== Ke.e && (Ke.e = t(u, "activeTab", Eo, Ke.e)), Ro !== Ke.t && (Ke.t = t(Ce, "label", Ro, Ke.t)), Ke;
            }, { e: undefined, t: undefined }), o;
          })()];
        } }), k), B(b, L(Y, { title: "SafeArea", get children() {
          var o = s("safeArea"), u = s("box"), d = s("text");
          return m(o, u), m(u, d), t(u, "background", Se), t(u, "cornerRadius", 8), t(u, "padding", 14), t(d, "label", "Insets past notches & system bars. (No visible effect here \u2014 the app root already applies one.)"), t(d, "fontSize", 12), t(d, "color", Q), o;
        } }), k), t(k, "label", "\u2014 end of UI demo \u2014"), t(k, "fontSize", 12), t(k, "color", H), b;
      })();
    }
    return L(Lr.View, {});
  }
  var mo = ["Just shipped a new feature, feeling great about how it turned out \uD83D\uDE80", "Hot take: the best APIs are the ones you don't have to read docs for", "Spent the morning refactoring legacy code \u2014 so much cleaner now", "There's no such thing as 'just a small change' in production code", "If your tests are slow, that's a smell. Fast tests = good tests", "Bun's startup time keeps surprising me, even after a year", "Why is naming things still the hardest part of programming?", "Found a 10\xD7 speedup in a critical path today. Profilers, not guesses", "Reading 'The Art of Unix Programming' for the third time", "Premature abstraction is somehow worse than premature optimization", "Latency is a feature, throughput is an artifact of how you measure", "Half of debugging is admitting your assumption was wrong", "You don't ship the codebase you have. You ship the codebase you understand", "Cache invalidation, naming things, off-by-one. The classics", "Every config file format eventually grows a turing-complete templating layer"], $l = Array.from({ length: 15000 }, (e, r) => ({ author: `@user${r * 2654435761 >>> 17}`, body: mo[r % mo.length], num: r + 1 })), Pl = [50, 200, 500, 1000, 2000, 5000, 1e4], wo = "#FFF1F5F9", So = "#FF475569", Al = "#FF22C55E", Ol = "#FFEF4444", yo = "#FFFFFFFF";
  function Fl(e) {
    const [r, n] = q(0), [i, a] = q(false), [l, c] = q(0), [g, f] = q(false);
    return (() => {
      var _ = s("column"), S = s("text"), w = s("text"), P = s("row"), p = s("button"), I = s("button");
      return m(_, S), m(_, w), m(_, P), t(_, "background", $e), t(_, "padding", 12), t(_, "cornerRadius", 10), t(_, "borderWidth", 1), t(_, "borderColor", xe), t(_, "gap", 6), t(S, "fontWeight", 700), t(S, "fontSize", 14), t(S, "color", "#FF1DA1F2"), t(w, "fontSize", 14), t(w, "color", "#FF1F2937"), t(w, "maxLines", 3), t(w, "textOverflow", 1), m(P, p), m(P, I), t(P, "gap", 10), t(p, "fontSize", 12), t(p, "padding", 6), t(p, "cornerRadius", 16), t(p, "onClick", () => {
        const R = !i();
        a(R), n(r() + (R ? 1 : -1));
      }), t(I, "fontSize", 12), t(I, "padding", 6), t(I, "cornerRadius", 16), t(I, "onClick", () => {
        const R = !g();
        f(R), c(l() + (R ? 1 : -1));
      }), G((R) => {
        var F = `#${e.num} \xB7 ${e.author}`, z = e.body, E = `\u2665 ${r()}`, A = i() ? Al : wo, h = i() ? yo : So, y = `\u21A9 ${l()}`, $ = g() ? Ol : wo, D = g() ? yo : So;
        return F !== R.e && (R.e = t(S, "label", F, R.e)), z !== R.t && (R.t = t(w, "label", z, R.t)), E !== R.a && (R.a = t(p, "label", E, R.a)), A !== R.o && (R.o = t(p, "background", A, R.o)), h !== R.i && (R.i = t(p, "color", h, R.i)), y !== R.n && (R.n = t(I, "label", y, R.n)), $ !== R.s && (R.s = t(I, "background", $, R.s)), D !== R.h && (R.h = t(I, "color", D, R.h)), R;
      }, { e: undefined, t: undefined, a: undefined, o: undefined, i: undefined, n: undefined, s: undefined, h: undefined }), _;
    })();
  }
  function Cl() {
    const [e, r] = q(50), [n, i] = q(""), a = 1;
    function l() {
      return (() => {
        var c = s("column"), g = s("text"), f = s("text"), _ = s("wrap"), S = s("text");
        return m(c, g), m(c, f), m(c, _), m(c, S), t(c, "gap", 12), t(g, "label", "Tweet feed \u2014 virtualized"), t(g, "fontSize", 24), t(g, "fontWeight", 800), t(g, "color", Q), t(f, "label", "ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."), t(f, "fontSize", 13), t(f, "color", H), t(_, "gap", 6), B(_, L(ue, { each: Pl, children: (w) => (() => {
          var P = s("button");
          return t(P, "label", `${w}`), t(P, "onClick", () => {
            const p = performance.now();
            try {
              r(w), i(`mounted ${w} in ${(performance.now() - p).toFixed(2)} ms`);
            } catch (I) {
              i(`ERROR @ ${w}: ${I && (I.message || String(I)) || "unknown"}`);
            }
          }), P;
        })() })), t(S, "fontSize", 12), t(S, "color", H), G((w) => t(S, "label", n() || `showing ${e()} tweets`, w)), c;
      })();
    }
    return (() => {
      var c = s("listView");
      return t(c, "background", Re), t(c, "padding", 16), t(c, "gap", 12), t(c, "renderItem", (g) => {
        if (g < a)
          return l();
        const f = $l[g - a];
        return f ? L(Fl, { get author() {
          return f.author;
        }, get body() {
          return f.body;
        }, get num() {
          return f.num;
        } }) : null;
      }), G((g) => t(c, "count", a + e(), g)), c;
    })();
  }
  function Il() {
    const [e, r] = q("\u2014 waiting for counter events \u2014"), n = js(), [i, a] = q("\u2014 tap a button to RPC the Ticker \u2014"), [l, c] = q(null), [g, f] = q(false);
    return (() => {
      var _ = s("scrollView"), S = s("text"), w = s("text"), P = s("text");
      return m(_, S), m(_, w), m(_, P), t(_, "background", Re), t(_, "padding", 16), t(_, "gap", 14), t(S, "label", "Libraries \u2014 codegen-wrapped widgets"), t(S, "fontSize", 24), t(S, "fontWeight", 800), t(S, "color", Q), t(w, "label", "Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."), t(w, "fontSize", 13), t(w, "color", H), B(_, vo && L(Y, { title: "FlutterEmbed \u2014 Shape C, real Flutter rendering", get children() {
        return [(() => {
          var p = s("text");
          return t(p, "label", "A multi-view Flutter Web view rendered inside a DOM region (lazy-loaded ~3 MB on first appearance). Click the button \u2014 the counter state lives in Dart, the +1 increment is a Flutter setState, not JS."), t(p, "fontSize", 11), t(p, "color", "#FF8E8E93"), p;
        })(), (() => {
          var p = s("flutterEmbed");
          return t(p, "widget", "counter"), t(p, "props", { initial: 0 }), t(p, "height", 120), t(p, "background", "#FFF7F7F8"), t(p, "cornerRadius", 8), p;
        })(), (() => {
          var p = s("flutterEmbed");
          return t(p, "widget", "greeting"), t(p, "props", { name: "Skal" }), t(p, "height", 60), t(p, "background", "#FFF7F7F8"), t(p, "cornerRadius", 8), p;
        })()];
      } }), P), B(_, L(Y, { title: "HtmlEmbed \u2014 Flutter with DOM holes", get children() {
        return [(() => {
          var p = s("text");
          return t(p, "label", "Each panel below is a real <div> hosted inside Flutter Web's render tree via HtmlElementView. Pointer events + text selection + keyboard input stay live. On native, falls back to a sized placeholder."), t(p, "fontSize", 11), t(p, "color", H), p;
        })(), (() => {
          var p = s("htmlEmbed");
          return t(p, "viewType", "html-card"), t(p, "height", 150), t(p, "background", "#FFFFFFFF"), t(p, "cornerRadius", 10), p;
        })(), (() => {
          var p = s("htmlEmbed");
          return t(p, "viewType", "solid-counter"), t(p, "height", 140), t(p, "background", "#FFF8FAFC"), t(p, "cornerRadius", 10), p;
        })(), (() => {
          var p = s("htmlEmbed");
          return t(p, "viewType", "skal-counter"), t(p, "height", 200), t(p, "background", "#FFF8FAFC"), t(p, "cornerRadius", 10), p;
        })(), (() => {
          var p = s("htmlEmbed");
          return t(p, "viewType", "skal-jsx-counter"), t(p, "height", 200), t(p, "background", "#FFF8FAFC"), t(p, "cornerRadius", 10), p;
        })(), (() => {
          var p = s("htmlEmbed");
          return t(p, "viewType", "youtube-embed"), t(p, "height", 220), t(p, "background", "#FF000000"), t(p, "cornerRadius", 8), p;
        })()];
      } }), P), B(_, L(Y, { title: "Greeting \u2014 hand-written adapter", get children() {
        var p = s("greeting");
        return t(p, "name", "Skal"), t(p, "color", "#FF1DA1F2"), t(p, "fontSize", 20), p;
      } }), P), B(_, L(Y, { title: "Shimmer \u2014 pub.dev, named-ctor wrap", get children() {
        return [(() => {
          var p = s("text");
          return t(p, "label", "ShimmerFromColors \u2014 codegen-synthesized from the Shimmer.fromColors named constructor."), t(p, "fontSize", 11), t(p, "color", H), p;
        })(), (() => {
          var p = s("shimmerFromColors"), I = s("greeting");
          return m(p, I), t(p, "baseColor", 4290624957), t(p, "highlightColor", 4292927712), t(p, "period", 1500), t(I, "name", "loading\u2026"), t(I, "color", "#FF333333"), t(I, "fontSize", 28), p;
        })()];
      } }), P), B(_, L(Y, { title: "QR code \u2014 qr_flutter, pub.dev wrap", get children() {
        return [(() => {
          var p = s("qrImageView");
          return t(p, "data", "https://skal.dev"), t(p, "size", 200), p;
        })(), (() => {
          var p = s("text");
          return t(p, "label", "QrImageView, generated against qr_flutter's class."), t(p, "fontSize", 11), t(p, "color", H), p;
        })()];
      } }), P), B(_, L(Y, { title: "Camera \u2014 host-pattern wrap (controller lifecycle)", get children() {
        return [(() => {
          var p = s("text");
          return t(p, "label", "A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> \u2014 no camera / permission \u2192 an inline error banner."), t(p, "fontSize", 11), t(p, "color", H), p;
        })(), (() => {
          var p = s("button");
          return t(p, "onClick", () => f(!g())), G((I) => t(p, "label", g() ? "Stop camera" : "Start camera", I)), p;
        })(), mn(() => mn(() => !!g())() && (() => {
          var p = s("box"), I = s("camera");
          return m(p, I), t(p, "background", "#FF000000"), t(p, "padding", 4), t(p, "cornerRadius", 8), t(I, "resolutionIndex", 1), p;
        })())];
      } }), P), B(_, L(Y, { title: "Counter \u2014 typed callbacks back to JSX", get children() {
        return [(() => {
          var p = s("counter");
          return t(p, "initial", 0), t(p, "onChanged", (I) => r(`onChanged(${I})`)), t(p, "onReset", () => r("onReset()")), p;
        })(), (() => {
          var p = s("text");
          return t(p, "fontSize", 13), t(p, "color", Q), G((I) => t(p, "label", e(), I)), p;
        })()];
      } }), P), B(_, L(Y, { title: "Ticker \u2014 JS \u2192 Dart imperative RPC", get children() {
        return [(() => {
          var p = s("ticker");
          return os(n, p), t(p, "intervalMs", 500), p;
        })(), (() => {
          var p = s("wrap"), I = s("button"), R = s("button"), F = s("button"), z = s("button"), E = s("button"), A = s("button"), h = s("button"), y = s("button");
          return m(p, I), m(p, R), m(p, F), m(p, z), m(p, E), m(p, A), m(p, h), m(p, y), t(p, "gap", 6), t(I, "label", "pause"), t(I, "onClick", async () => {
            await n.pause(), a("pause() \u2713");
          }), t(R, "label", "resume"), t(R, "onClick", async () => {
            await n.resume(), a("resume() \u2713");
          }), t(F, "label", "reset"), t(F, "onClick", async () => {
            await n.reset(), a("reset() \u2713");
          }), t(z, "label", "+10"), t(z, "onClick", async () => {
            await n.bump(10), a(`bump(10), now getValue() \u2192 ${await n.getValue()}`);
          }), t(E, "label", "read"), t(E, "onClick", async () => {
            a(`getValue() \u2192 ${await n.getValue()}, isPaused() \u2192 ${await n.isPaused()}`);
          }), t(A, "label", "describe"), t(A, "onClick", async () => {
            a(`describe() \u2192 ${await n.describe("hello from JSX")}`);
          }), t(h, "label", "snapshot"), t(h, "onClick", async () => {
            const $ = await n.snapshot();
            a(`snapshot() \u2192 value=${$.value} paused=${$.paused} ts=${$.timestamp}`);
          }), t(y, "label", "sub/unsub"), t(y, "onClick", () => {
            if (l())
              l()(), c(() => null), a("unsubscribed from ticks$");
            else {
              const $ = n.ticks$((D) => {
                a(`stream tick: ${D}`);
              });
              c(() => $), a("subscribed to ticks$ \u2014 wait for emissions\u2026");
            }
          }), p;
        })(), (() => {
          var p = s("text");
          return t(p, "fontSize", 13), t(p, "color", Q), G((I) => t(p, "label", i(), I)), p;
        })()];
      } }), P), B(_, L(Y, { title: "Stickers \u2014 List<Widget> children + gradient prop", get children() {
        var p = s("stickers"), I = s("greeting"), R = s("greeting"), F = s("greeting");
        return m(p, I), m(p, R), m(p, F), t(p, "gap", 6), t(p, "padding", 10), t(p, "gradient", { type: "linear", colors: ["#FFFFE082", "#FFB0F0D0", "#FFB0E0FF"], stops: [0, 0.5, 1], begin: "topLeft", end: "bottomRight" }), t(I, "name", "multi-child A"), t(I, "color", "#FF6B4F00"), t(I, "fontSize", 14), t(R, "name", "multi-child B"), t(R, "color", "#FF6B4F00"), t(R, "fontSize", 14), t(F, "name", "multi-child C"), t(F, "color", "#FF6B4F00"), t(F, "fontSize", 14), p;
      } }), P), t(P, "label", "\u2014 end of Libs demo \u2014"), t(P, "fontSize", 12), t(P, "color", H), _;
    })();
  }
  var xo = (e) => Array.from(e, (r) => r.toString(16).padStart(2, "0")).join(""), Dl = new Function("m", "return import(m);"), ft = (e) => Dl(e), ze = (e, r) => e && e[r] || e && e.default && e.default[r] || undefined, ko = [...vo ? [{ title: "Web plugin bridge \u2014 geolocator (B.5, web only)", probes: [{ label: "geolocator.getCurrentPosition \u2014 lat/lon via hidden Flutter Web", run: async () => {
    const e = performance.now(), r = await Sl(), n = (performance.now() - e).toFixed(0);
    return `${r.lat.toFixed(4)}, ${r.lon.toFixed(4)} (\xB1${r.accuracy.toFixed(0)}m, ${n}ms \u2014 includes Flutter Web cold boot on first call)`;
  } }] }] : [], { title: "Web Crypto \u2014 crypto.subtle (global, native)", probes: [{ label: "crypto.randomUUID()", run: () => crypto.randomUUID() }, { label: "crypto.getRandomValues \u2014 16 bytes", run: () => {
    const e = new Uint8Array(16);
    return crypto.getRandomValues(e), xo(e);
  } }, { label: "crypto.subtle.digest \u2014 SHA-256 of 64 KB", run: async () => {
    const e = new Uint8Array(65536);
    crypto.getRandomValues(e);
    const r = await crypto.subtle.digest("SHA-256", e);
    return xo(new Uint8Array(r)).slice(0, 32) + "\u2026";
  } }, { label: "crypto.subtle \u2014 AES-GCM encrypt + decrypt", run: async () => {
    const e = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]), r = crypto.getRandomValues(new Uint8Array(12)), n = new TextEncoder().encode("hello from skal"), i = await crypto.subtle.encrypt({ name: "AES-GCM", iv: r }, e, n), a = await crypto.subtle.decrypt({ name: "AES-GCM", iv: r }, e, i);
    return `${i.byteLength}-byte ct \u2192 "${new TextDecoder().decode(a)}"`;
  } }] }, { title: "Bun runtime \u2014 degrades gracefully if absent", probes: [{ label: "Bun.version", run: () => {
    if (typeof Bun > "u")
      throw new Error("Bun global not present");
    return `Bun ${Bun.version}` + (Bun.revision ? ` (${Bun.revision.slice(0, 7)})` : "");
  } }, { label: "Bun.nanoseconds()", run: () => {
    if (typeof Bun > "u")
      throw new Error("Bun global not present");
    return `${Bun.nanoseconds()} ns since process start`;
  } }, { label: "Bun.hash('the quick brown fox')", run: () => {
    if (typeof Bun > "u")
      throw new Error("Bun global not present");
    return String(Bun.hash("the quick brown fox"));
  } }, { label: "new Bun.CryptoHasher('sha256')", run: () => {
    if (typeof Bun > "u" || !Bun.CryptoHasher)
      throw new Error("Bun.CryptoHasher not present");
    const e = new Bun.CryptoHasher("sha256");
    return e.update("hello from skal"), e.digest("hex").slice(0, 32) + "\u2026";
  } }, { label: "bun:sqlite \u2014 in-memory query", run: async () => {
    const e = await ft("bun:sqlite"), r = ze(e, "Database") || e.default;
    if (typeof r != "function")
      throw new Error("bun:sqlite imported, but no Database constructor");
    const n = new r(":memory:");
    n.run("CREATE TABLE t (id INTEGER, name TEXT)"), n.run("INSERT INTO t VALUES (1, 'skal')");
    const i = n.query("SELECT name FROM t WHERE id = ?").get(1);
    return n.close(), `select \u2192 ${JSON.stringify(i)}`;
  } }] }, { title: "Node compatibility \u2014 node: builtins", probes: [{ label: "process \u2014 platform / arch / version", run: () => {
    if (typeof process > "u")
      throw new Error("process global not present");
    return `${process.platform} ${process.arch} \xB7 ${process.version || "(no version)"}`;
  } }, { label: "node:crypto \u2014 createHash('sha256')", run: async () => {
    const e = ze(await ft("node:crypto"), "createHash");
    if (!e)
      throw new Error("node:crypto has no createHash");
    return e("sha256").update("hello from skal").digest("hex").slice(0, 32) + "\u2026";
  } }, { label: "node:crypto \u2014 randomBytes(16)", run: async () => {
    const e = ze(await ft("node:crypto"), "randomBytes");
    if (!e)
      throw new Error("node:crypto has no randomBytes");
    return e(16).toString("hex");
  } }, { label: "node:os \u2014 platform / arch / cpus", run: async () => {
    const e = await ft("node:os"), r = ze(e, "platform"), n = ze(e, "arch"), i = ze(e, "cpus");
    if (!r)
      throw new Error("node:os has no platform()");
    return `${r()} ${n()} \xB7 ${i().length} cpus`;
  } }, { label: "node:path \u2014 join + normalize", run: async () => {
    const e = ze(await ft("node:path"), "join");
    if (!e)
      throw new Error("node:path has no join");
    return e("/a/b", "..", "c", "./d.txt");
  } }, { label: "Buffer \u2014 from / toString", run: () => {
    if (typeof Buffer > "u")
      throw new Error("Buffer global not present");
    return `hex = ${Buffer.from("skal", "utf8").toString("hex")}`;
  } }, { label: "node:fs \u2014 temp write + read", run: async () => {
    const e = await ft("node:fs"), r = await ft("node:os"), n = await ft("node:path"), i = ze(e, "writeFileSync"), a = ze(e, "readFileSync"), l = ze(e, "unlinkSync"), c = ze(r, "tmpdir"), g = ze(n, "join");
    if (!i || !a || !c || !g)
      throw new Error("node:fs / os / path missing an expected member");
    const f = g(c(), `skal-probe-${Date.now()}.txt`);
    i(f, "skal fs probe");
    const _ = a(f, "utf8");
    try {
      l && l(f);
    } catch {}
    return `wrote + read back "${_}"`;
  } }] }, { title: "Standard JS & Web APIs", probes: [{ label: "JSON stringify + parse \u2014 1000-object array", run: () => {
    const e = Array.from({ length: 1000 }, (i, a) => ({ id: a, name: "item" + a, ok: a % 2 === 0 })), r = JSON.stringify(e), n = JSON.parse(r);
    return `${r.length} bytes \xB7 ${n.length} items round-tripped`;
  } }, { label: "TextEncoder / TextDecoder round-trip", run: () => {
    const e = new TextEncoder().encode("skal \uD83D\uDE80 unicode \u2713");
    return `${e.length} bytes \u2192 "${new TextDecoder().decode(e)}"`;
  } }, { label: "structuredClone \u2014 nested object", run: () => {
    if (typeof structuredClone > "u")
      throw new Error("structuredClone not present");
    const e = structuredClone({ a: 1, nested: { b: [1, 2, 3] } });
    return `cloned \u2192 nested.b = ${JSON.stringify(e.nested.b)}`;
  } }, { label: "setTimeout \u2014 20 ms timer (see duration)", run: async () => {
    if (typeof setTimeout > "u")
      throw new Error("setTimeout not present");
    return await new Promise((e) => setTimeout(e, 20)), "timer fired \u2014 measured duration \u2248 requested 20 ms";
  } }, { label: "tight compute loop \u2014 5,000,000 iterations", run: () => {
    let e = 0;
    for (let r = 0;r < 5000000; r++)
      e += r % 7;
    return `sum = ${e}`;
  } }] }], To = 3000;
  function zl(e) {
    let r;
    const n = new Promise((i, a) => {
      r = setTimeout(() => a(new Error(`timed out after ${To} ms`)), To);
    });
    return Promise.race([Promise.resolve().then(() => e.run()), n]).finally(() => clearTimeout(r));
  }
  function Ll() {
    const [e, r] = q({}), [n, i] = q(false), a = () => typeof performance < "u" && performance.now ? performance.now() : Date.now();
    async function l() {
      if (!n()) {
        i(true), r({});
        for (const c of ko)
          for (const g of c.probes) {
            const f = a();
            let _, S = true;
            try {
              _ = String(await zl(g));
            } catch (P) {
              _ = P && P.message ? P.message : String(P), S = false;
            }
            const w = a() - f;
            r((P) => ({ ...P, [g.label]: { ms: w, response: _, ok: S } }));
          }
        i(false);
      }
    }
    return Kn(() => {
      l();
    }), (() => {
      var c = s("scrollView"), g = s("text"), f = s("text"), _ = s("button");
      return m(c, g), m(c, f), m(c, _), t(c, "background", Re), t(c, "padding", 16), t(c, "gap", 14), t(c, "scrollbar", true), t(g, "label", "JS runtime \u2014 probes & timings"), t(g, "fontSize", 24), t(g, "fontWeight", 800), t(g, "color", Q), t(f, "label", "Each function runs in the embedded bun + JSC runtime; its duration and response are logged. Bun / bun:sqlite probes report an error (not a crash) if the runtime doesn't expose them."), t(f, "fontSize", 13), t(f, "color", H), t(_, "onClick", l), B(c, L(ue, { each: ko, children: (S) => L(Y, { get title() {
        return S.title;
      }, get children() {
        return L(ue, { get each() {
          return S.probes;
        }, children: (w) => {
          const P = () => e()[w.label], p = () => {
            const I = P();
            return I ? I.response.length > 110 ? I.response.slice(0, 110) + "\u2026" : I.response : "not run yet";
          };
          return (() => {
            var I = s("column"), R = s("text"), F = s("text"), z = s("text");
            return m(I, R), m(I, F), m(I, z), t(I, "gap", 2), t(R, "fontSize", 13), t(R, "fontWeight", 700), t(R, "color", Q), t(F, "fontSize", 11), t(F, "fontWeight", 700), t(F, "color", se), t(z, "fontSize", 12), t(z, "maxLines", 3), G((E) => {
              var A = w.label, h = P() ? `${P().ms.toFixed(3)} ms` : "\u2014", y = p(), $ = P() ? P().ok ? H : St : H;
              return A !== E.e && (E.e = t(R, "label", A, E.e)), h !== E.t && (E.t = t(F, "label", h, E.t)), y !== E.a && (E.a = t(z, "label", y, E.a)), $ !== E.o && (E.o = t(z, "color", $, E.o)), E;
            }, { e: undefined, t: undefined, a: undefined, o: undefined }), I;
          })();
        } });
      } }) }), null), G((S) => t(_, "label", n() ? "Running\u2026" : "Re-run all probes", S)), c;
    })();
  }
  var fe = ml({ counter: 0, note: "", scratch: "", settings: { theme: "dark" }, todos: [], archive: [] }, { version: 1, paths: { scratch: { persist: false }, archive: { lazy: true } } });
  function Ml() {
    const e = fe[Cn], r = () => e.backendKind() === "native" || e.backendKind() === "mmap" || e.backendKind() === "fs", n = () => {
      const a = e.engineStats();
      return `${a ? `${a.records} records \xB7 ${a.segments} segments` : "engine: \u2026"} \xB7 ${e.pending()} pending \xB7 ${e.flushes()} flushes`;
    }, i = () => {
      const a = e.initTiming();
      return a ? `init total ${a.total}ms \u2014 dir-RPC ${a.dir} \xB7 open ${a.open} \xB7 migrate ${a.migrate} \xB7 hydrate ${a.hydrate} (${a.records} records)` : "init: running\u2026";
    };
    return (() => {
      var a = s("scrollView"), l = s("text"), c = s("text"), g = s("text");
      return m(a, l), m(a, c), m(a, g), t(a, "background", Re), t(a, "padding", 16), t(a, "gap", 14), t(a, "scrollbar", true), t(l, "label", "createSkalStore \u2014 reactive \xB7 persistent \xB7 deep-object"), t(l, "testID", "store-title"), t(l, "fontSize", 23), t(l, "fontWeight", 800), t(l, "color", Q), t(c, "fontSize", 14), t(c, "fontWeight", 800), t(g, "fontSize", 12), t(g, "color", H), B(a, L(Y, { title: "Values \u2014 mutate the object directly", get children() {
        return [(() => {
          var f = s("row"), _ = s("button"), S = s("text");
          return m(f, _), m(f, S), t(f, "gap", 10), t(_, "label", "counter + 1"), t(_, "onClick", () => {
            fe.counter = fe.counter + 1;
          }), t(S, "fontSize", 16), t(S, "fontWeight", 800), t(S, "color", se), G((w) => t(S, "label", `db.counter = ${fe.counter}`, w)), f;
        })(), (() => {
          var f = s("row"), _ = s("button"), S = s("text");
          return m(f, _), m(f, S), t(f, "gap", 10), t(_, "label", "toggle theme"), t(_, "onClick", () => {
            fe.settings.theme = fe.settings.theme === "dark" ? "light" : "dark";
          }), t(S, "fontSize", 14), t(S, "fontWeight", 700), t(S, "color", Q), G((w) => t(S, "label", `db.settings.theme = ${fe.settings.theme}`, w)), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "note \u2014 persisted; each change writes one tiny per-leaf frame"), t(f, "fontSize", 11), t(f, "color", H), f;
        })(), (() => {
          var f = s("textInput");
          return t(f, "placeholder", "persisted text\u2026"), t(f, "onChange", (_) => {
            fe.note = _;
          }), G((_) => t(f, "value", fe.note, _)), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "scratch \u2014 config persist:false, so memory only (gone on restart)"), t(f, "fontSize", 11), t(f, "color", H), f;
        })(), (() => {
          var f = s("textInput");
          return t(f, "placeholder", "memory-only text\u2026"), t(f, "onChange", (_) => {
            fe.scratch = _;
          }), G((_) => t(f, "value", fe.scratch, _)), f;
        })()];
      } }), null), B(a, L(Y, { title: "Collection \u2014 todos (array of objects)", get children() {
        return [(() => {
          var f = s("wrap"), _ = s("button"), S = s("button"), w = s("button"), P = s("button");
          return m(f, _), m(f, S), m(f, w), m(f, P), t(f, "gap", 8), t(_, "label", "Add"), t(_, "onClick", () => fe.todos.push({ text: "todo " + Date.now() })), t(S, "label", "Add 100"), t(S, "onClick", () => Xn(() => {
            for (let p = 0;p < 100; p++)
              fe.todos.push({ text: "bulk " + Date.now() + " #" + p });
          })), t(w, "label", "Remove first"), t(w, "onClick", () => {
            fe.todos.length && fe.todos.shift();
          }), t(P, "label", "Clear"), t(P, "onClick", () => {
            fe.todos.splice(0, fe.todos.length);
          }), f;
        })(), (() => {
          var f = s("text");
          return t(f, "fontSize", 12), t(f, "fontWeight", 700), t(f, "color", se), G((_) => t(f, "label", `${fe.todos.length} todos \u2014 add/remove writes one element frame + the index, never the whole list`, _)), f;
        })(), (() => {
          var f = s("box"), _ = s("listView");
          return m(f, _), t(f, "height", 220), t(f, "cornerRadius", 10), t(f, "background", Se), t(_, "scrollbar", true), B(_, L(ue, { get each() {
            return fe.todos;
          }, children: (S) => (() => {
            var w = s("box"), P = s("text");
            return m(w, P), t(w, "padding", 8), t(w, "background", $e), t(w, "cornerRadius", 6), t(w, "borderWidth", 1), t(w, "borderColor", xe), t(P, "fontSize", 12), t(P, "color", Q), G((p) => t(P, "label", S.text, p)), w;
          })() })), f;
        })()];
      } }), null), B(a, L(Y, { title: "Lazy \u2014 archive (config lazy:true)", get children() {
        return [(() => {
          var f = s("row"), _ = s("button");
          return m(f, _), t(f, "gap", 8), t(_, "label", "Add to archive"), t(_, "onClick", () => fe.archive.push({ text: "archived " + Date.now() })), f;
        })(), (() => {
          var f = s("text");
          return t(f, "fontSize", 12), t(f, "color", H), G((_) => t(f, "label", `${fe.archive.length} records \u2014 not loaded at open; faults in from disk on first access`, _)), f;
        })()];
      } }), null), B(a, L(Y, { title: "Engine", get children() {
        return [(() => {
          var f = s("text");
          return t(f, "fontSize", 11), t(f, "color", H), t(f, "maxLines", 2), G((_) => t(f, "label", n(), _)), f;
        })(), (() => {
          var f = s("text");
          return t(f, "fontSize", 11), t(f, "color", H), t(f, "maxLines", 2), G((_) => t(f, "label", i(), _)), f;
        })(), (() => {
          var f = s("button");
          return t(f, "label", "Flush now"), t(f, "onClick", () => e.flushNow()), f;
        })(), (() => {
          var f = s("text");
          return t(f, "label", "Writes are debounced + batched into one engine flush; reads are pure in-memory."), t(f, "fontSize", 11), t(f, "color", H), f;
        })()];
      } }), null), G((f) => {
        var _ = `Backend: ${e.backendKind()} \xB7 schema v${e.version()}`, S = r() ? ke : De, w = r() ? "Persisted \u2014 change values, quit, and re-run to verify they survive a restart." : "In-memory fallback \u2014 no writable backend, so data resets on restart.";
        return _ !== f.e && (f.e = t(c, "label", _, f.e)), S !== f.t && (f.t = t(c, "color", S, f.t)), w !== f.a && (f.a = t(g, "label", w, f.a)), f;
      }, { e: undefined, t: undefined, a: undefined }), a;
    })();
  }
  function Bl() {
    const [e, r] = Ys(0, "appTab");
    return (() => {
      var n = s("tabs"), i = s("tab"), a = s("tab"), l = s("tab"), c = s("tab"), g = s("tab");
      return m(n, i), m(n, a), m(n, l), m(n, c), m(n, g), t(n, "onChange", r), t(n, "height", "fill"), t(i, "title", "UI"), t(i, "icon", "grid"), B(i, L(Rl, {})), t(a, "title", "List"), t(a, "icon", "list"), B(a, L(Cl, {})), t(l, "title", "Libs"), t(l, "icon", "explore"), B(l, L(Il, {})), t(c, "title", "JS"), t(c, "icon", "code"), B(c, L(Ll, {})), t(g, "title", "Store"), t(g, "icon", "storage"), B(g, L(Ml, {})), G((f) => t(n, "activeTab", e(), f)), n;
    })();
  }
  var Nl = ".".repeat(1500);
  function Wl(e) {
    const r = e.count || 1500, n = Array.from({ length: r }, (a, l) => l), i = Math.max(1, Math.round(r * 1.5 / 768));
    return Kn(() => {
      console.log(`[skal-stress] mounted ${r} rows (~1.5 KB each); overflow resets = ${globalThis.__skal_opRingResets | 0}`);
    }), (() => {
      var a = s("scrollView"), l = s("text");
      return m(a, l), t(a, "background", Re), t(a, "padding", 16), t(a, "gap", 6), t(a, "scrollbar", true), t(l, "label", `Skal overflow stress \u2014 ${r} rows \xD7 ~1.5 KB \u2192 overflows the 768 KiB string heap ~${i}\xD7 in one mount`), t(l, "fontSize", 15), t(l, "fontWeight", 800), t(l, "color", Q), B(a, L(ue, { each: n, children: (c) => (() => {
        var g = s("box"), f = s("text");
        return m(g, f), t(g, "background", $e), t(g, "cornerRadius", 6), t(g, "padding", 8), t(f, "label", `Row ${c}: ${Nl}`), t(f, "fontSize", 12), t(f, "maxLines", 1), t(f, "textOverflow", 1), t(f, "color", yl), g;
      })() }), null), a;
    })();
  }
  var Dn = 0;
  if (typeof location < "u" && location.search) {
    const e = new URLSearchParams(location.search).get("stress");
    e && (Dn = Math.min(20000, Math.max(0, parseInt(e, 10) || 0)));
  }
  if (Dn > 0)
    vn(() => L(Wl, { count: Dn }), wn);
  else {
    const e = () => L(Bl, {});
    globalThis.__skalHot ? globalThis.__skalHot.mount(e) : vn(e, wn);
  }
})();
})

"use client"

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { HeroUIProvider } from "@heroui/system";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Collapse } from "react-collapse";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import { CourseId, errorName, ServerInfo, ServerResponse } from "../../shared/types";
import { useMediaQuery } from "./clientutil";
import { bgColor, borderColor, Button, Loading } from "./util";

export type ModalCtxType = {
	extraActions: Element|null,
	closeModal: ()=>void,
	setLoading: (loading?: boolean)=>void
};

export type ModalAction = {
	name: React.ReactNode,
	act: (ctx: ModalCtxType)=>(void|boolean),
	icon?: React.ReactNode,
	status?: "primary"|"bad"
};

export type AppModal = {
	type: "error", name: string, msg: string, retry?: () => void
} | {
	type: "other", name?: string,
	actions?: ModalAction[],
	onClose?: () => void, modal?: React.ReactNode
};

export type Auth = {id: string, key: string};

export function setAuth(x: Auth|null) {
	if (x==null) window.localStorage.removeItem("auth");
	else window.localStorage.setItem("auth", JSON.stringify(x));
}

export function isAuthSet() {
	return window.localStorage.getItem("auth")!=null;
}

export type AuthErr = ServerResponse<unknown>&{status: "error", error: "unauthorized"|"sessionExpire"};

export function useSignInRedirect() {
	const router = useRouter();
	const app = useContext(AppCtx);
	const forward = app.forward;
	return useCallback((err?: AuthErr, back?: string) => {
		forward(back);
		window.localStorage.setItem("signIn", JSON.stringify({err, redirect: window.location.href}));
		router.push("/signin");
	}, [router, forward]);
}

export type Theme = "dark"|"light";

export type AppCtx = {
	open: (m: AppModal) => void,
	popupCount: number, incPopupCount: ()=>number,
	forward: (back?: string)=>void, back: ()=>void,
	goto: (to: string)=>void,
	info: ServerInfo,
	theme: Theme, setTheme: (x: Theme)=>void,
	hasAuth: boolean|null,
	setHasAuth: (x: boolean)=>void,
	restoreScroll: ()=>void
};

export const AppCtx = React.createContext<AppCtx>("context not initialized" as unknown as AppCtx)

const cache: Record<string, Promise<ServerResponse<unknown>>> = {};

export type APICallResult<T,R> = {res: R, endpoint: string, req: T|undefined};

export type APIOptions<T,R> = {
	data?: T, method?: string,
	//lmao
	//null = don't handle error / no retries/popup
	//undefined = handle error
	//both result in null response
	handleErr?: (e: ServerResponse<R>&{status:"error"}) => R|null|undefined,
	noCache?: boolean, cb?: (resp: APICallResult<T,R>|null)=>void,
	refresh?: (resp: APICallResult<T,R>)=>void
};

function getBodyKey<T,R>(endpoint: string, x: APIOptions<T,R>) {
	const body = JSON.stringify(x.data); //hehe, cursed
	return [body, `${x.method ?? "POST"} ${endpoint}\n${body}`];
};

type APIAuth = "redirect"|"maybe"|"unset";

export function useAPI<R,T=null>(endpoint: string, auth?: APIAuth) {
	const {open: openModal, setHasAuth} = useContext(AppCtx);
	const i = useRef(0);
	const redir = useSignInRedirect();

	const run = useCallback(async (body: string, k: string,
		{data, method, handleErr, noCache}: APIOptions<T,R>, rerun: ()=>void) => {

		let cacheBad = cache[k]==undefined || noCache || auth;
		while (!cacheBad) {
			try {
				const t = cache[k];
				const r = await t;
				if (t!=cache[k]) continue;
				if (r.status!="ok") cacheBad=true;
			} catch {
				cacheBad=true;
			};

			break;
		}

		const headers: Record<string,string> = {};
		if (auth) {
			const x = window.localStorage.getItem("auth");
			if (x!=null) {
				const v = JSON.parse(x) as Auth;
				headers["Authorization"] = `Basic ${v.id} ${v.key}`;
			} else if (auth=="unset") {
				return null;
			} else if (auth=="redirect") {
				openModal({type: "other", name: "You need to login to access this feature",
					actions: [
						{name: "Continue to sign in", status: "primary", act() {redir();}}
					]
				});

				return null;
			}
		}

		if (cacheBad) {
			cache[k] = fetch(`/api/${endpoint}`, {
				method: method ?? "POST",
				body: data==undefined ? undefined : body,
				headers
			}).then(x=>x.json()) as Promise<ServerResponse<R>>;
		}

		const resp = await cache[k] as ServerResponse<R>;

		if (resp.status=="error") {
			const recover = handleErr?.(resp);
			if (recover!=undefined) return {
				res: recover, endpoint, req: data
			};

			if (auth && (resp.error=="unauthorized" || resp.error=="sessionExpire") && recover!==null) {
				if (auth=="unset") {
					setAuth(null);
					setHasAuth(false);
				} else {
					redir({...resp, error: resp.error});
				}
			} else if (recover!==null) {
				console.error(resp);
				openModal({
					type: "error", name: errorName(resp.error),
					msg: resp.message ?? "Error performing API request.", retry: rerun
				});
			}

			return null;
		} else {
			return {res: resp.result, endpoint, req: data};
		}
	}, [openModal, setHasAuth, auth, endpoint, redir]);

	const [v, setV] = useState<APICallResult<T,R>|null>(null);
	const [loading, setLoading] = useState(false);

	const reallyRun = useCallback((x: APIOptions<T,R> = {})=>{
		const [body, k] = getBodyKey(endpoint, x);

		const oi = ++i.current;
		setLoading(true);

		run(body, k, x, ()=>reallyRun(x)).then((res) => {
			if (i.current==oi) {
				x.cb?.(res);
				setLoading(false);

				if (res!=null) {
					setV(res);
					x.refresh?.(res);
				}
			}
		}).catch((e) => {
			console.error(`Fetching ${endpoint}: ${e}`);

			openModal({
				type: "error", name: "Error reaching API",
				msg: `Fetch error: ${e instanceof Error ? e.message : e}. Try refreshing?`,
				retry: ()=>reallyRun(x)
			});
		});
	}, [endpoint, openModal, run]);

	return {
		run: reallyRun,
		clear: useCallback(()=>{
			setLoading(false);
			setV(null);
		}, []),
		clearCache: useCallback((x: APIOptions<T,R> ={})=>{
			const [,k] = getBodyKey(endpoint, x);
			delete cache[k];
		}, [endpoint]),
		current: v,
		loading
	};
}

export function setAPI<R,T=null>(endpoint: string, {data,method,result}: {
	data?: T, method?: string, result: R
}) {
	const r: ServerResponse<R> = { status: "ok", result };
	cache[`${method ?? "POST"} ${endpoint}\n${JSON.stringify(data)}`] = Promise.resolve(r);
}

export function useAPIResponse<R,T=null>(endpoint: string, {
	auth, debounceMs, ...x
}: APIOptions<T,R>&{auth?: APIAuth, debounceMs?: number, disabled?: boolean} = {}) {
	const {run, clear, current, loading} = useAPI<R,T>(endpoint, auth);

	const k = getBodyKey(endpoint, x)[1];
	const [lastK, setLastK] = useState(k);
	const [curOpts, setCurOpts] = useState(x);
	useEffect(()=>{
		if (k!=lastK) {
			setCurOpts(x);
			setLastK(k);
		}
	}, [k,x,lastK]);

	const [latest, setLatest] = useState(false);
	useEffect(()=>{
		if (curOpts.disabled) {
			clear();
			return;
		}

		if (debounceMs) {
			setLatest(false);

			const tm = setTimeout(()=>{
				run(curOpts);
				setLatest(true);
			}, debounceMs);

			return () => clearTimeout(tm);
		} else {
			run(curOpts);
			setLatest(true);
		}
	}, [clear, curOpts, debounceMs, run]);

	return useMemo(()=>
		current ? {...current, loading: !latest || loading} : null,
	[current,latest,loading]);
}

export const useInfo = (): ServerInfo => useContext(AppCtx).info;
export const useCourse = (id: number): CourseId|null =>
	useAPIResponse<CourseId,number>("course", {data:id})?.res ?? null;

export const ModalCtx = createContext<ModalCtxType|null>(null);

export function ModalActions({children}: {children?: React.ReactNode}) {
	const ctx = useContext(ModalCtx)!;
	return <>
		{children && ctx.extraActions && createPortal(children, ctx.extraActions)}
	</>;
}

function ModalContentInner({closeAll, close, x}: {x: AppModal&{type: "other"}, close: ()=>void, closeAll?: ()=>void}) {
	const [extra, setExtra] = useState<Element|null>(null);
	const [ld, setLd] = useState<boolean>(false);
	const extraRef = useRef<HTMLDivElement>(null);

	const setLoading = useCallback((x?: boolean)=>setLd(x===undefined || x===true), [setLd]);
	const ctx: ModalCtxType = useMemo(()=>({
		extraActions: extra,
		closeModal: close,
		setLoading
	}), [extra, close, setLoading]);

	useEffect(()=>setExtra(extraRef.current), [x]);

	return <Collapse isOpened >
		{x.name && <ModalHeader className="font-display font-extrabold text-2xl" >{x.name}</ModalHeader>}
		{x.modal && <ModalBody>
			<ModalCtx.Provider value={ctx} >
				{x.modal}
			</ModalCtx.Provider>
		</ModalBody>}
		<ModalFooter className="py-2" >
			{ld ? <Loading/> : <>
				<div ref={extraRef} className="contents" ></div>
				{x.actions && x.actions.map((x,i) =>
					<Button key={i} onClick={()=>{
						const ret = x.act(ctx);
						if (ret===undefined || ret===true) close();
					}} className={x.status==null ? "" : (x.status=="primary" ? bgColor.sky : bgColor.red)}
						icon={x.icon} >
						{x.name}
					</Button>
				)}
				<Button onClick={close} >Close</Button>
				{closeAll && <Button onClick={closeAll} className={bgColor.red} >Close all</Button>}
			</>}
		</ModalFooter>
	</Collapse>;
}

declare global {
	interface Window {
		goatcounter: {
			count: (x: {path: string})=>void,
			no_onload: boolean,
			allow_local: boolean,
			endpoint: string
		}
	}
}

export function GoatCounter({goatCounter}: {goatCounter: string}) {
	const path = usePathname();
	const initPath = useRef(path);
	useEffect(() => {
		if (initPath.current==path) return;

		const gt = window.goatcounter;
		if (gt) gt.count({path});
	}, [path]);

	return <Script strategy="lazyOnload" src="/count.js" onLoad={() => {
		window.goatcounter.no_onload = true;
		window.goatcounter.allow_local = true;
		window.goatcounter.endpoint = `https://${goatCounter}.goatcounter.com/count`;
		
		window.goatcounter.count({path});
	}} />;
}

type Back = {
	url: string,
	scrollPos?: number
};

type ModalState = {
	active: AppModal[],
	visible: Record<"error"|"other", boolean>
};

const defaultModalState: ModalState = {
	active: [], visible: {error: false, other: false}
};

export function AppWrapper({children, className, info}: {
	children: React.ReactNode, className?: string, info: ServerInfo
}) {
	//😒
	const [modals, setModals] = useState<ModalState>(defaultModalState);
	const activeNormals = modals.active.filter(x=>x.type=="other");
	const activeErrors = modals.active.filter(x=>x.type=="error");

	const [backUrls, setBackUrls] = useState<Back[]>([]);
	const [restoreScroll, setRestoreScroll] = useState<number|undefined>();
	const router = useRouter();

	const [theme, setTheme] = useState<Theme>("dark");

	const isDark = useMediaQuery("(prefers-color-scheme: dark)");
	const updateTheme = useCallback(()=>{
		const t: Theme = (window.localStorage.getItem("theme") as Theme) ?? (isDark ? "dark" : "light");
		setTheme(t);
	}, [setTheme, isDark]);

	useEffect(updateTheme, [updateTheme]);

	useEffect(()=>{
		const html = document.getElementsByTagName("html")[0];
		html.classList.add(theme);
		return () => html.classList.remove(theme);
	}, [theme]);

	const path = usePathname();

	const [hasAuth, setHasAuth] = useState<boolean|null>(null);
	useEffect(()=>setHasAuth(isAuthSet()), []);

	const popupCountRef = useRef(0);
	const [count, setCount] = useState(0);

	const openModal = useCallback((m: AppModal) => {
		setCount(x=>x+1);
		setModals(modals => {
			if (!modals.visible[m.type]) return {
				active: [...modals.active.filter(x=>x.type!=m.type), m],
				visible: {...modals.visible, [m.type]: true}
			};
			else return {active: [...modals.active, m], visible: modals.visible};
		});
	}, []);

	const forward = useCallback((back?: string)=>{
		setBackUrls(backUrls=>[...backUrls, {
			url: back ? new URL(back, window.location.href).href : window.location.href,
			scrollPos: back ? undefined : window.scrollY
		}]);
		setRestoreScroll(undefined);
		setModals(defaultModalState);
		setCount(++popupCountRef.current);
	}, [setBackUrls, setRestoreScroll, setModals, setCount]);

	const incPopupCount = useCallback(()=>{
		const count = ++popupCountRef.current;
		setCount(count);
		return count;
	}, []);

	const goto = useCallback((to: string) => {
		forward();
		router.push(to);
	}, [forward, router]);

	const goBack = useCallback(() => {
		let i=backUrls.length;
		while (i>0 && new URL(backUrls[i-1].url).pathname==path) i--;

		if (i==0) router.push("/");
		else {
			const nb = backUrls.slice(0,i-1);
			router.push(backUrls[i-1].url);
			setRestoreScroll(backUrls[i-1].scrollPos);
			setBackUrls(nb);
		}
	}, [backUrls, setBackUrls, setRestoreScroll, router, path]);

	const doRestoreScroll = useCallback(()=>{
		if (restoreScroll) {
			window.scrollTo({top: restoreScroll, behavior: "instant"});
			setRestoreScroll(undefined);
		}
	}, [restoreScroll, setRestoreScroll]);

	const doSetTheme = useCallback((x: Theme) => {
		window.localStorage.setItem("theme", x);
		updateTheme();
	}, [updateTheme])

	const appCtx: AppCtx = useMemo(()=>({
		restoreScroll: doRestoreScroll,
		open: openModal,
		popupCount: count,
		incPopupCount, forward, goto,
		back: goBack, info, theme,
		setTheme: doSetTheme,
		hasAuth, setHasAuth
	}), [
		count, doRestoreScroll, forward,
		goBack, goto, hasAuth, incPopupCount,
		info, openModal, theme, doSetTheme
	]);

	let m = <></>;
	const closeModal = (x: AppModal) => setModals(modals=>{
		const remaining = modals.active.filter(y=>y!=x);
		if (remaining.some(y=>y.type==x.type)) return {
			active: remaining, visible: modals.visible
		}; else return {
			active: remaining, visible: {...modals.visible, [x.type]: false}
		};
	});

	if (activeNormals.length>0) {
		const x = activeNormals[activeNormals.length-1];
		m = <Modal isOpen={modals.visible["other"]} onClose={() => {
			x.onClose?.();
			closeModal(x);
		}} backdrop="blur" placement="center" classNames={{
			base: "overflow-visible"
		}} >
			<ModalContent>
				{(close) => <ModalContentInner close={close}
					closeAll={activeNormals.length>1 ? ()=>setModals(modals=>(
						{...modals, visible: {...modals.visible, other: false}}
					)) : undefined}
					x={x} />}
			</ModalContent>
		</Modal>;
	}
	
	if (activeErrors.length>0) {
		const x = activeErrors[activeErrors.length-1];
		const retry = x.retry!=undefined ? x.retry : null;

		m = <>{m}<Modal isOpen={modals.visible["error"]} onClose={()=>closeModal(x)}
			className={`border ${bgColor.red} ${borderColor.red}`} backdrop="blur" placement="bottom-center" >
			<ModalContent>
				{(close) => (
					<>
						{x.name && <ModalHeader className="font-display font-extrabold text-2xl" >{x.name}</ModalHeader>}
						<ModalBody> <p>{x.msg}</p> </ModalBody>
						<ModalFooter className="py-2" >
							{retry ? <Button onClick={() => {close(); retry();}} >Retry</Button>
								: <Button onClick={close} >Close</Button>}
						</ModalFooter>
					</>
				)}
			</ModalContent>
		</Modal></>;
	}

  return (<HeroUIProvider>
		<AppCtx.Provider value={appCtx} >
			{m}
			<div id="parent" className={twMerge("flex flex-col container mx-auto p-4 lg:px-14 lg:pt-9 max-w-screen-xl", className)}>
				{children}
			</div>
		</AppCtx.Provider>
  </HeroUIProvider>);
}
"use client"

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@nextui-org/modal";
import { NextUIProvider } from "@nextui-org/system";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
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

export function redirectToSignIn() {
	const router = useRouter();
	const app = useContext(AppCtx);
	return (err?: AuthErr, back?: string) => {
		app.forward(back);
		window.localStorage.setItem("signIn", JSON.stringify({err, redirect: window.location.href}));
		router.push("/signin");
	};
}

export type Theme = "dark"|"light";

export type AppCtx = {
	open: (m: AppModal) => void,
	popupCount: number, incPopupCount: ()=>void,
	forward: (back?: string)=>void, back: ()=>void,
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

export function callAPI<R,T=null>(endpoint: string, auth?: APIAuth) {
	const c = useContext(AppCtx);
	const i = useRef(0);
	const redir = auth ? redirectToSignIn() : null;

	const run = async (body: string, k: string,
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
				c.open({type: "other", name: "You need to login to access this feature",
					actions: [
						{name: "Continue to sign in", status: "primary", act() {redir!();}}
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
					c.setHasAuth(false);
				} else {
					redir!({...resp, error: resp.error});
				}
			} else if (recover!==null) {
				console.error(resp);
				c.open({
					type: "error", name: errorName(resp.error),
					msg: resp.message ?? "Error performing API request.", retry: rerun
				});
			}

			return null;
		} else {
			return {res: resp.result, endpoint, req: data};
		}
	};

	const [v, setV] = useState<APICallResult<T,R>|null>(null);
	const [loading, setLoading] = useState(false);

	return {
		call(x: APIOptions<T,R> ={}) {
			const [body, k] = getBodyKey(endpoint, x);

			const attempt = () => {
				const oi = ++i.current;
				setLoading(true);

				run(body, k, x, attempt).then((res) => {
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

					c.open({
						type: "error", name: "Error reaching API",
						msg: `Fetch error: ${e instanceof Error ? e.message : e}. Try refreshing?`, retry: attempt
					});
				});
			};

			return {attempt, k};
		},
		run(x: APIOptions<T,R> ={}) {
			this.call(x).attempt();
		},
		clearCache(x: APIOptions<T,R> ={}) {
			const [,k] = getBodyKey(endpoint, x);
			delete cache[k];
		},
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

export function useAPI<R,T=null>(endpoint: string, {
	auth, debounceMs, ...x
}: APIOptions<T,R>&{auth?: APIAuth, debounceMs?: number} = {}) {
	const api = callAPI<R,T>(endpoint, auth);
	const y = api.call(x);

	const [latest, setLatest] = useState(false);
	useEffect(()=>{
		if (debounceMs) {
			setLatest(false);

			const tm = setTimeout(()=>{
				y.attempt();
				setLatest(true);
			}, debounceMs);

			return () => clearTimeout(tm);
		} else {
			y.attempt();
			setLatest(true);
		}
	}, [y.k]);

	return api.current ? {...api.current, loading: !latest || api.loading} : null;
}

export const useInfo = (): ServerInfo => useContext(AppCtx).info;
export const useCourse = (id: number): CourseId|null =>
	useAPI<CourseId,number>("course", {data:id})?.res ?? null;

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

	const ctx: ModalCtxType = {
		extraActions: extra,
		closeModal: close,
		setLoading: (x?: boolean)=>setLd(x===undefined || x===true)
	};

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

export function AppWrapper({children, className, info}: {children: React.ReactNode, className?: string, info: ServerInfo}) {
	//😒
	const [activeModals, setActiveModals] = useState<AppModal[]>([]);
	const [modalExtra, setModalVisible] = useState<Record<"error"|"other", boolean>>({
		error: false, other: false
	});
	const activeNormals = activeModals.filter(x=>x.type=="other");
	const activeErrors = activeModals.filter(x=>x.type=="error");
	const setVis = (x: "error"|"other", y: boolean) =>
		setModalVisible((vis) => ({...vis, [x]:y}));

	let m = <></>;
	if (activeNormals.length>0) {
		const x = activeNormals[activeNormals.length-1];
		m = <Modal isOpen={modalExtra["other"]} onClose={() => {
			x.onClose?.();
			if (activeNormals.length>1)
				setActiveModals(activeModals.filter(y=>y!=x));
			else setVis("other", false);
		}} backdrop="blur" placement="center" classNames={{
			base: "overflow-visible"
		}} >
			<ModalContent>
				{(close) => <ModalContentInner close={close}
						closeAll={activeNormals.length>1 ? ()=>setVis("other", false) : undefined}
						x={x} />}
			</ModalContent>
		</Modal>;
	}
	
	if (activeErrors.length>0) {
		const x = activeErrors[activeErrors.length-1];
		const retry = x.retry!=undefined ? x.retry : null;

		m = <>{m}<Modal isOpen={modalExtra["error"]} onClose={() => {
			if (activeErrors.length>1) setActiveModals(activeModals.filter(y=>y!=x));
			else setVis("error", false);
		}} className={`border ${bgColor.red} ${borderColor.red}`} backdrop="blur"
			placement="bottom-center" >
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

	const [count, setCount] = useState(0);

	const [backUrls, setBackUrls] = useState<Back[]>([]);
	const [restoreScroll, setRestoreScroll] = useState<number|undefined>();
	const router = useRouter();

	const [theme, setTheme] = useState<Theme>("dark");

	const updateTheme = ()=>{
		const t: Theme = (window.localStorage.getItem("theme") as Theme) ?? (isDark ? "dark" : "light");
		setTheme(t);
	};

	const isDark = useMediaQuery("(prefers-color-scheme: dark)");
	useEffect(updateTheme, [isDark]);

	useEffect(()=>{
		const html = document.getElementsByTagName("html")[0];
		html.classList.add(theme);
		return () => html.classList.remove(theme);
	}, [theme]);

	const path = usePathname();

	const [hasAuth, setHasAuth] = useState<boolean|null>(null);
	useEffect(()=>setHasAuth(isAuthSet()), []);

  return (<NextUIProvider>
		<AppCtx.Provider value={{
			restoreScroll() {
				if (restoreScroll) {
					window.scrollTo({top: restoreScroll, behavior: "instant"});
					setRestoreScroll(undefined);
				}
			},
			open: (m) => {
				setCount(x=>x+1);
				if (!modalExtra[m.type]) {
					setActiveModals((active) => [...active.filter(x=>x.type!=m.type), m]);
					setVis(m.type, true);
				} else setActiveModals((active) => [...active, m]);
			},
			popupCount: count,
			incPopupCount: () => setCount(x=>x+1),
			forward(back) {
				setBackUrls([...backUrls, {
					url: back ? new URL(back, window.location.href).href : window.location.href,
					scrollPos: back ? undefined : window.scrollY
				}]);
				setRestoreScroll(undefined);
				setActiveModals([]);
				setCount(x=>x+1);
			}, back() {
				let i=backUrls.length;
				while (i>0 && new URL(backUrls[i-1].url).pathname==path) i--;

				if (i==0) router.push("/");
				else {
					const nb = backUrls.slice(0,i-1);
					router.push(backUrls[i-1].url);
					setRestoreScroll(backUrls[i-1].scrollPos);
					setBackUrls(nb);
				}
			}, info, theme, setTheme(x) {
				window.localStorage.setItem("theme", x);
				updateTheme();
			},
			hasAuth, setHasAuth
		}}>

			{m}
			<div id="parent" className={twMerge("flex flex-col container mx-auto p-4 lg:px-14 lg:mt-5 max-w-screen-xl", className)}>
				{children}
			</div>
		</AppCtx.Provider>
  </NextUIProvider>);
}
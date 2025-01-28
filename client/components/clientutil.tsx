"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover";
import { Progress } from "@heroui/progress";
import { Tooltip, TooltipPlacement } from "@heroui/tooltip";
import { IconArrowLeft, IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp, IconFilter, IconInfoCircle, IconInfoTriangleFilled } from "@tabler/icons-react";
import Link, { LinkProps } from "next/link";
import React, { HTMLAttributes, PointerEvent, useContext, useEffect, useRef, useState } from "react";
import { Collapse } from "react-collapse";
import { default as Select, SingleValue } from "react-select";
import { twMerge } from "tailwind-merge";
import { formatTerm, Section, Term, termIdx } from "../../shared/types";
import { Anchor, bgColor, borderColor, Button, containerDefault, Input, selectProps, Text, textColor } from "./util";
import { AppCtx, useInfo } from "./wrapper";

export type SelectionContextType = {
	section: Section|null,
	selSection: (section: Section) => void,
	deselectSection: (section: Section) => void,
	selTerm: (term: Term) => void
};

export const SelectionContext = React.createContext<SelectionContextType>({
	section: null, selSection(){}, deselectSection() {}, selTerm() {}
});

export function useMediaQuery(q: MediaQueryList|string|null, init: boolean=false) {
	const [x, set] = useState(init);

	useEffect(() => {
		if (q==null) return;

		const mq = typeof q=="string" ? window.matchMedia(q) : q;
		const cb = () => set(mq.matches);
		mq.addEventListener("change", cb);
		set(mq.matches);
		return ()=>mq.removeEventListener("change",cb);
	}, [q]);

	return x;
}

const queries: Record<"md"|"lg",MediaQueryList|null> = {md:null, lg:null};

export const useMd = () => {
	try {
		if (queries.md==null)
			queries.md = window.matchMedia("(min-width: 768px)");
	} catch {;}

	return useMediaQuery(queries.md);
};

export const useLg = () => {
	try {
		if (queries.lg==null)
			queries.lg = window.matchMedia("(min-width: 1024px)");
	} catch {;}

	return useMediaQuery(queries.lg);
};

export function useGpaColor() {
	const isDark = useContext(AppCtx).theme=="dark";
	return (gpa: number|null): string|undefined => {
		if (gpa==null) return undefined;
		gpa = Math.min(Math.max(gpa, 0), 4);
		return isDark
			? `hsl(${13+(107-13)*Math.pow(gpa,2.5)/Math.pow(4.0,2.5)}, 68%, 42%)`
			: `hsl(${13+(107-13)*Math.pow(gpa,2.5)/Math.pow(4.0,2.5)}, 75%, 60%)`;
	};
}

export function useDebounce<T>(f: ()=>T, debounceMs: number): T {
	const [v, setV] = useState(f);
	useEffect(()=>{
		const ts = setTimeout(()=>setV(f()), debounceMs);
		return () => clearTimeout(ts);
	}, [f, debounceMs]);
	return v;
}

export const IsInTooltipContext = React.createContext(false);

//opens in modal if already in tooltip...
export function AppTooltip({content, children, placement, className, onChange, ...props}: {
	content: React.ReactNode, placement?: TooltipPlacement, onChange?: (x: boolean)=>void
}&Omit<HTMLAttributes<HTMLDivElement>,"content">) {

	const {open: openModal, incPopupCount, popupCount} = useContext(AppCtx);
	const [open, setOpen] = useState(false);
	const [reallyOpen, setReallyOpen] = useState<number|null>(null);
	
	const ctx = useContext(IsInTooltipContext);
	const unInteract = (p: PointerEvent<HTMLDivElement>) => {
		if (!ctx && p.pointerType=="mouse") setOpen(false);
	};

	const interact = (p: PointerEvent<HTMLDivElement>) => {
		if (!ctx && p.pointerType=="mouse") setOpen(true);
	};

	const selCtx = useContext(SelectionContext);
	const isOpen = reallyOpen==popupCount;

	useEffect(()=>{
		if (open) {
			if (ctx) {
				console.log("Running open");
				setReallyOpen(incPopupCount());
				openModal({type: "other", modal: <SelectionContext.Provider value={selCtx} >
						{content}
					</SelectionContext.Provider>, onClose() {
					setOpen(false);
					setReallyOpen(null);
				}});
			} else {
				const tm = setTimeout(() => {
					setReallyOpen(incPopupCount());
				}, 200);

				const cb = ()=>setOpen(false);
				document.addEventListener("click", cb);

				return ()=>{
					document.removeEventListener("click", cb);
					clearTimeout(tm);
				};
			}
		} else if (!ctx) {
			const tm = setTimeout(() => setReallyOpen(null), 500);
			return ()=>clearTimeout(tm);
		}

	//dont want to reopen on selection change / content change
	//maybe eventually ill overhaul my modal system and this will all be reasonable
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [incPopupCount, openModal, ctx, open]);

	useEffect(()=> {
		onChange?.(isOpen);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen])
	
	return <Tooltip showArrow placement={placement} content={
			<IsInTooltipContext.Provider value={true} >{content}</IsInTooltipContext.Provider>
		}
		classNames={{content: "max-w-96"}}
		isOpen={isOpen}
		onPointerEnter={interact} onPointerLeave={unInteract} >

		<div className={twMerge("inline-block", className)}
			onPointerEnter={interact} onPointerLeave={unInteract}
			onClick={(ev)=>{
				setOpen(!isOpen);
				ev.stopPropagation();
			}} {...props} >

			{children}
		</div>
	</Tooltip>;
}

export function AppLink(props: LinkProps&HTMLAttributes<HTMLAnchorElement>) {
	const app = useContext(AppCtx);
	return <Link {...props} onClick={(ev) => {
		app.forward();
		props.onClick?.(ev);
	}} >
		{props.children}
	</Link>
}

export const BackButton = ({children, noOffset}: {children?: React.ReactNode, noOffset?: boolean}) =>
	<div className='flex flex-row gap-3 align-middle'>
		<Anchor className={`lg:mt-1 mr-1 h-fit hover:-translate-x-0.5 transition ${
			noOffset ? "" : "lg:absolute lg:-left-10"}`}
			onClick={useContext(AppCtx).back} >
			<IconArrowLeft className="self-center" size={30} />
		</Anchor>

		{children && <div className="md:text-3xl text-2xl font-extrabold font-display flex flex-col items-start">
			{children}
		</div>}
	</div>;

export function useSearchState<T>(start: T, init: (params: URLSearchParams) => T|undefined|null, change: (x:T)=>URLSearchParams|undefined|null): [T, (newX: T)=>void] {
	const [x,setX] = useState<T>(start);

	useEffect(()=>{
		const u = new URLSearchParams(window.location.search);
		if (u.size>0) {
			const t = init(u);
			if (t!=undefined) {
				window.history.replaceState(null,"",`?${change(t)?.toString()??""}`);
				setX(t);
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return [x, (newX: T) => {
		const p = change(newX);
		window.history.replaceState(null,"",`?${p?.toString()??""}`);
		setX(newX);
	}];
}

export function StyleClasses({f,classStyles}: {f: (setRef: React.Ref<HTMLElement|null>)=>React.ReactNode, classStyles: Record<string, Partial<CSSStyleDeclaration>>}) {
	const ref = useRef<HTMLElement|null>(null);
	useEffect(()=>{
		const e = ref.current!;
		for (const [cls, styles] of Object.entries(classStyles)) {
			const st = (e.getElementsByClassName(cls)[0] as HTMLElement).style;
			for (const k in styles)
				if (styles[k]!==undefined) st[k]=styles[k];
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return f(ref);
}

export function BarsStat<T>({lhs,type,vs,className}: {
	lhs: (x: T, inTerm: boolean)=>React.ReactNode,
	type: "gpa"|"rmp", vs: [T,number|null, boolean][], className?: string
}) {
	const gpaColor = useGpaColor();

	if (vs.length==0) return <Text v="md" className="w-full text-center mt-5 mb-3" >
		No data available
	</Text>;

	const y=vs.toSorted((a,b)=>{
		return (b[1]??-1) - (a[1]??-1);
	}).map(([i,x,b], j): [boolean, React.ReactNode]=>{
		if (x==null) {
			return [b,<React.Fragment key={j} >
				{lhs(i, b)}
				<div className="col-span-2 flex-row flex items-center" >
					<span className={`h-0.5 border-b border-dotted flex-grow mx-2 ${borderColor.default}`} />
					<p className="col-span-2 my-auto ml-auto" >
						No {type=="rmp" ? "rating" : "grades"} available
					</p>
				</div>
			</React.Fragment>];
		}

		const c = gpaColor(type=="gpa" ? x : x-1);
		return [b,<React.Fragment key={-j} >
			{lhs(i, b)}
			<div className="flex flex-row items-center" >
				<StyleClasses f={(ref)=>
					<Progress value={x} minValue={type=="gpa" ? 0 : 1} maxValue={type=="gpa" ? 4 : 5} classNames={{
						indicator: "indicator"
					}} ref={ref} aria-label="GPA" />}
					classStyles={{indicator: {backgroundColor: c}}}
				/>
			</div>

			<span className="px-2 py-1 rounded-lg my-auto font-black font-display text-xl text-center" style={{backgroundColor: c}} >
				{x.toFixed(1)}
			</span>
		</React.Fragment>];
	});

	const fst=y.filter(v=>v[0]), snd=y.filter(v=>!v[0]);
	return <div className={twMerge("grid gap-2 grid-cols-[2fr_10fr_1fr] items-center", className)} >
		{fst.map(x=>x[1])}
		{snd.length>0 && <>
			{fst.length>0 && <Text v="bold" className="col-span-3" >Other terms</Text>}
			{snd.map(x=>x[1])}
		</>}
	</div>;
}

export function NameSemGPA<T>({vs,lhs}: {
	vs: [T, [Term, number|null, number|null][], boolean][],
	lhs: (x: T, inTerm: boolean)=>React.ReactNode
}) {
	const selCtx = useContext(SelectionContext);
	const gpaColor = useGpaColor();
	
	const numSems = useMd() ? 5 : 3;
	const sems = [...new Set(vs.flatMap(x => x[1]).map(x=>x[0]))]
		.sort((a,b) => termIdx(a)-termIdx(b)).slice(-numSems);

	if (sems.length==0)
		return <Text v="md" className="text-center mt-5 mb-3" >No data available</Text>;

	const sorted = vs.map((x):[T, [Term, number|null, number|null][], number, boolean]=> {
		const bySem = new Map(x[1].map(v=>[v[0],v]));

		let count=0;
		const semData = sems.map(s=>{
			const y = bySem.get(s);
			if (y?.[1]) count++;
			return [s,y?.[1] ?? null,y?.[2] ?? null];
		}) satisfies [Term, number|null, number|null][];

		return [ x[0], semData, count, x[2] ];
	}).sort((a,b)=>b[2]-a[2]);

	const nodes = sorted.map(([i, x, _, b], j) => 
		[b, <div key={j} className='flex flex-col mt-1 mb-2'>
			{lhs(i, b)}
			<div className='grid grid-flow-col auto-cols-fr justify-stretch'>
				{x.map(([sem, gpa, sections]) => (
					<div key={sem} className='flex flex-col mt-2'>
						<div className="flex flex-col h-12 items-center justify-center py-5"
							style={{backgroundColor: gpaColor(gpa)}} >

							<Text v="bold" className='font-black' >{gpa?.toFixed(1) ?? "?"}</Text>
							{sections!=null && <Text v="sm" >
								{sections} section{sections==1?"":"s"}
							</Text>}
						</div>
						<Anchor onClick={() => selCtx.selTerm(sem)}
							className={`${textColor.gray} text-sm justify-center text-center`} >{formatTerm(sem)}</Anchor>
					</div>
				))}
			</div>
		</div>] as const
	);
	
	const fst = nodes.filter(x=>x[0]), snd=nodes.filter(x=>!x[0]);
	return <div>
		{fst.map(x=>x[1])}
		{snd.map(x=>x[1])}
	</div>;
}

export function WrapStat({search, setSearch, title, children, searchName}: {search: string, setSearch: (x:string)=>void, title: string, children: React.ReactNode, searchName: string}) {
	const md = useMd();
	return <>
		<Input icon={<IconFilter/>} placeholder={`Filter ${searchName}...`}
			value={search} onChange={v => setSearch(v.target.value)} />
		<Text v="md" className="mt-2 mb-1" >{title}</Text>
		{md ? <Collapse isOpened >
			<div className="max-h-[34rem] overflow-y-auto mb-2" >
				{children}
			</div>
		</Collapse> : <ShowMore maxh="34rem" className="mb-2" forceShowMore={search!=""} >
			{children}
		</ShowMore>}
	</>;
}

export function TermSelect({term, terms, setTerm, label, noUpdated}: {
	term: Term, terms: Term[], setTerm: (t:Term)=>void, label?: string, noUpdated?: boolean
}) {
	const info = useInfo();
	return <div className="flex flex-wrap flex-row items-center gap-3 text-sm" >
		{label} <Select
			options={terms.map((x):[number,Term]=>[termIdx(x), x])
				.sort((a,b)=>b[0]-a[0])
				.map(([,x]) => ({label: formatTerm(x), value: x}))}
			value={{label: formatTerm(term), value: term}}
			onChange={(x: SingleValue<{label: string, value: Term}>) => setTerm(x!.value)}
			{...selectProps<{label:string,value:Term},false>()}
		/>
		{!noUpdated && <span className="text-gray-400" >
			last updated {new Date(info.terms[term]!.lastUpdated).toLocaleDateString()}
		</span>}
	</div>;
}

// used for client side filtering (e.g. instructors in prof tabs)
export const simp = (x: string) => x.toLowerCase().replace(/[^a-z0-9\n]/g, "");

export const Alert = ({title, txt, bad, className}: {title?: React.ReactNode, txt: React.ReactNode, bad?: boolean, className?: string}) =>
	<div className={twMerge(`border ${bad ? `${bgColor.red} ${borderColor.red}` : `${bgColor.default} ${borderColor.default}`} p-2 px-4 rounded-md flex flex-row gap-2`, className)} >
		<div className={`flex-shrink-0 ${title ? "mt-1" : ""}`} >
			{bad ? <IconInfoTriangleFilled/> : <IconInfoCircle/>}
		</div>
		<div>
			{title && <h2 className="font-bold font-display text-lg" >{title}</h2>}
			<div>{txt}</div>
		</div>
	</div>;

export type DropdownPart = ({type: "txt", txt?: React.ReactNode}
	| { type: "act", name?: React.ReactNode, act: ()=>void,
			disabled?: boolean, active?: boolean })&{key?: string|number};

export function Dropdown({parts, trigger, onOpenChange}: {trigger?: React.ReactNode, parts: DropdownPart[], onOpenChange?: (x:boolean)=>void}) {
	const [open, setOpen] = useState(false);
	const app = useContext(AppCtx);
	useEffect(()=>{
		setOpen(false); onOpenChange?.(false);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [app.popupCount]);

	//these components are fucked up w/ preact and props don't merge properly with container element
	return <Popover placement="bottom" showArrow isOpen={open}
		onOpenChange={(x)=>{
			setOpen(x);
			onOpenChange?.(x);
		}} triggerScaleOnOpen={false} >
		<PopoverTrigger><div>{trigger}</div></PopoverTrigger>
		<PopoverContent className="rounded-md dark:bg-zinc-900 bg-zinc-100 dark:border-gray-800 border-zinc-300 px-0 py-0 max-w-60 overflow-y-auto justify-start max-h-[min(90dvh,30rem)]" >
			<div><IsInTooltipContext.Provider value={true} >
				{parts.map((x,i) => {
					if (x.type=="act")
						return <Button key={x.key ?? i} disabled={x.disabled}
							className={`m-0 dark:border-zinc-700 border-zinc-300 border-b-0.5 border-t-0.5 rounded-none first:rounded-t-md last:rounded-b-md dark:hover:bg-zinc-700 hover:bg-zinc-300 w-full ${
								x.active ? "dark:bg-zinc-950 bg-zinc-200" : ""
							}`}
							onClick={() => {
								x.act();
								setOpen(false);
								onOpenChange?.(false);
							}} >{x.name}</Button>;
					else return <div key={x.key ?? i}
						className="flex flex-row justify-start gap-4 p-2 dark:bg-zinc-900 bg-zinc-100 items-center border m-0 dark:border-zinc-700 border-zinc-300 border-t-0 first:border-t rounded-none first:rounded-t-md last:rounded-b-md w-full" >
						{x.txt}
					</div>;
				})}
			</IsInTooltipContext.Provider></div>
		</PopoverContent>
	</Popover>;
}

export function MoreButton({children, className, act: hide, down}: {act: ()=>void, children?: React.ReactNode, className?: string, down?: boolean}) {
	return <div className={twMerge("flex flex-col w-full items-center", className)} >
		<button onClick={hide} className={`flex flex-col items-center cursor-pointer transition ${down ? "hover:translate-y-1" : "hover:-translate-y-1"}`} >
			{down ? <>{children}<IconChevronDown/></>
				: <><IconChevronUp/>{children}</>}
		</button>
	</div>
}

export const fadeGradient = {
	default: "from-transparent dark:to-neutral-950 to-zinc-100",
	primary: "from-transparent dark:to-zinc-800 to-zinc-200",
	secondary: "from-transparent dark:to-zinc-900 to-zinc-150"
};

export function ShowMore({children, className, maxh, forceShowMore, inContainer}: {
	children: React.ReactNode, className?: string, maxh?: string,
	forceShowMore?: boolean, inContainer?: "primary"|"secondary"
}) {
	const [showMore, setShowMore] = useState<boolean|null>(false);
	const inner = useRef<HTMLDivElement>(null), ref=useRef<HTMLDivElement>(null);

	useEffect(()=>{
		const a=inner.current!, b=ref.current!;
		const check = () => {
			const disableShowMore = !forceShowMore && a.scrollHeight<=b.clientHeight+100;
			setShowMore(showMore=>disableShowMore ? null : (showMore ?? false));
		};

		const observer = new ResizeObserver(check);
		observer.observe(a); observer.observe(b);
		return ()=>observer.disconnect();
	}, [forceShowMore]);

	const expanded = showMore==null || showMore==true || forceShowMore;

	return <div className={className} >
		<Collapse isOpened >
			<div ref={ref} className={`relative ${expanded ? "" : "max-h-52 overflow-y-hidden"}`} style={{maxHeight: expanded ? undefined : maxh}}>
				<div ref={inner} className={expanded ? "overflow-y-auto max-h-dvh" : ""} >
					{children}
				</div>

				{!expanded && <div className="absolute bottom-0 left-0 right-0 z-40" >
					<MoreButton act={()=>setShowMore(true)} down >
						Show more
					</MoreButton>
				</div>}

				{!expanded &&
					<div className={`absolute bottom-0 h-14 max-h-full bg-gradient-to-b z-20 left-0 right-0 ${fadeGradient[inContainer ?? "default"]}`} />}
			</div>

			{showMore && <MoreButton act={()=>{
				ref.current?.scrollIntoView({block: "start", behavior: "smooth"});
				setShowMore(false)
			}} className="pt-2" >
				Show less
			</MoreButton>}
		</Collapse>
	</div>;
}

export function Carousel({items}: {items: React.ReactNode[]}) {
	const carouselRef = useRef<HTMLDivElement>(null);
	const [scrollLR, setScrollLR] = useState({l: false, r: false});
	useEffect(() => {
		const onScroll = () => {
			setScrollLR({
				l: carouselRef.current!.scrollLeft>50,
				r: carouselRef.current!.scrollLeft+carouselRef.current!.offsetWidth+50<carouselRef.current!.scrollWidth
			});
		};

		onScroll();

		const el = carouselRef.current!;
		el.addEventListener("scroll", onScroll);
		return ()=>el.removeEventListener("scroll", onScroll);
	}, [])

	return <div className="relative w-full" >
		{scrollLR.l && <button className={`absolute left-0 w-20 ${fadeGradient.primary} bg-gradient-to-l flex flex-col justify-center items-start pl-2 h-full z-30 border-none outline-none group`}
			onClick={()=>carouselRef.current!.scrollTo({
				left: carouselRef.current!.scrollLeft-0.95*carouselRef.current!.clientWidth,
				behavior: "smooth"
			})} >
			<IconChevronLeft size={35} className="group-hover:-translate-x-2 transition" />
		</button>}
		{scrollLR.r && <button className={`absolute right-0 w-20 ${fadeGradient.primary} bg-gradient-to-r flex flex-col justify-center items-end pr-2 h-full z-30 border-none outline-none group`}
			onClick={()=>carouselRef.current!.scrollTo({
				left: carouselRef.current!.scrollLeft+0.95*carouselRef.current!.clientWidth,
				behavior: "smooth"
			})} >
			<IconChevronRight size={35} className="group-hover:translate-x-2 transition" />
		</button>}
		<div className={`flex flex-row flex-nowrap overflow-x-auto w-full ${containerDefault} p-1 gap-2 md:p-3 md:gap-3`} ref={carouselRef} >
			{items.map((it,i)=>
				<div className={`flex-shrink-0 basis-96 ${bgColor.secondary} max-w-[80dvw]`} key={i} >
					{it}
				</div>
			)}
		</div>
	</div>
}
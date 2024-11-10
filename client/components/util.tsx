import { Popover, PopoverContent, PopoverTrigger } from "@nextui-org/popover";
import { Spinner, SpinnerProps } from "@nextui-org/spinner";
import { IconChevronDown } from "@tabler/icons-react";
import Image from "next/image";
import { LinkProps } from "next/link";
import React, { AnchorHTMLAttributes, forwardRef, HTMLAttributes } from "react";
import { ClassNamesConfig, Props as SelectProps } from "react-select";
import { ClassNameValue, twMerge } from "tailwind-merge";
import purdue from "../public/purdue-icon.png";
import reddit from "../public/reddit-icon.png";
import { AppLink } from "./clientutil";
import { Footer } from "./footer";
import { LogoText } from "./logo";

export const textColor = {
	contrast: "dark:text-white text-black",
	sky: "dark:text-sky-400 text-sky-700",
	green: "dark:text-green-500 text-green-700",
	red: "dark:text-red-500 text-red-700",
	default: "dark:text-zinc-100 text-zinc-800 dark:disabled:text-gray-400 disabled:text-gray-500",
	link: "text-gray-700 dark:text-gray-200 underline-offset-2 transition-all hover:text-black dark:hover:text-gray-50 hover:bg-cyan-800/5 dark:hover:bg-cyan-100/5 cursor-pointer underline decoration-dashed decoration-1",
	blueLink: "dark:text-blue-200 text-sky-800",
	star: "dark:text-amber-400 text-amber-600",
	gray: "dark:text-gray-200 text-gray-700"
};

export const bgColor = {
	default: "dark:bg-zinc-800 bg-zinc-200 dark:disabled:bg-zinc-600",
	md: "dark:bg-zinc-850 bg-zinc-150 dark:disabled:bg-zinc-600",
	hover: "dark:bg-zinc-700 bg-zinc-150",
	secondary: "dark:bg-zinc-900 bg-zinc-150",
	green: "dark:enabled:bg-green-600 enabled:bg-green-400",
	sky: "dark:enabled:bg-sky-600 enabled:bg-sky-300",
	red: "dark:enabled:bg-red-800 enabled:bg-red-300",
	rose: "dark:enabled:bg-rose-900 enabled:bg-rose-300",
	highlight: "dark:bg-amber-600 bg-amber-200",
	restriction: "dark:bg-amber-900 bg-amber-100",
	divider: "dark:bg-zinc-500 bg-zinc-400",
	contrast: "dark:bg-white bg-black"
}

export const borderColor = {
	default: "border-zinc-300 dark:border-zinc-600 disabled:bg-zinc-300 aria-expanded:border-blue-500 data-[selected=true]:border-blue-500 outline-none",
	red: "border-red-400 dark:border-red-600",
	defaultInteractive: "focus:outline-none border-zinc-300 hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500 disabled:bg-zinc-300 aria-expanded:border-blue-500 focus:border-blue-500 active:border-blue-500 dark:focus:border-blue-500 dark:active:border-blue-500 data-[selected=true]:border-blue-500 outline-none",
};

export const containerDefault = `${textColor.default} ${bgColor.default} ${borderColor.default} rounded-md border-1`;
export const interactiveContainerDefault = `${textColor.default} ${bgColor.default} ${borderColor.defaultInteractive} border-1`;

export const Anchor: React.FC<(AnchorHTMLAttributes<HTMLAnchorElement>)&Partial<LinkProps>> = ({className,href,...props}) => {
	const classN = twMerge(
		`inline-flex flex-row align-baseline items-baseline gap-1 cursor-pointer`, textColor.link, className
	);

	//special protocols which nextjs link can't handle...
	if (href?.startsWith("mailto:"))
		return <a className={classN} href={href} {...props} >{props.children}</a>
	else if (href!=undefined)
		return <AppLink href={href} rel="noopener noreferrer" className={classN} {...props} >
			{props.children}
		</AppLink>;
	else return <a className={classN} href="#" {...props} onClick={(ev) => {
		ev.preventDefault();
		props.onClick?.(ev);
	}} >{props.children}</a>
}

export type InputProps = {icon?: React.ReactNode}&React.InputHTMLAttributes<HTMLInputElement>;
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	function Input({className, icon, ...props}, ref) {
		return <div className={twMerge("relative", className)} >
			<input ref={ref} type="text" className={`w-full p-2 border-2 transition duration-300 rounded-lg ${icon ? "pl-11" : ""} ${interactiveContainerDefault}`} {...props} />
			{icon && <div className="absolute left-0 my-auto pl-3 top-0 bottom-0 flex flex-row items-center" >
				{icon}
			</div>}
		</div>;
	}
);

export const Textarea = forwardRef<HTMLTextAreaElement, JSX.IntrinsicElements["textarea"]>(function Textarea(
	{className, children, ...props}: JSX.IntrinsicElements["textarea"], ref
) {
	return <textarea className={twMerge("w-full p-2 border-2 transition duration-300 rounded-lg resize-y max-h-60 min-h-24", interactiveContainerDefault, className)}
		rows={6} {...props} ref={ref} tabIndex={100} >
		{children}
	</textarea>;
});

export const Button = ({className, disabled, icon, ...props}: HTMLAttributes<HTMLButtonElement>&{icon?: React.ReactNode, disabled?: boolean}) =>
	<button disabled={disabled} className={twMerge("flex flex-row justify-center gap-1.5 px-4 py-1.5 items-center rounded-xl group", interactiveContainerDefault, icon ? "pl-3" : "", className)} {...props} >
		{icon}
		{props.children}
	</button>;

export const HiddenInput = ({className, ...props}: React.InputHTMLAttributes<HTMLInputElement>) =>
	<input className={twMerge(`bg-transparent border-0 outline-none border-b-2
		focus:outline-none focus:border-blue-500 transition duration-300 px-1 py-px`, borderColor.default, className)}
		{...props} ></input>

export const IconButton = ({className, icon, disabled, ...props}: {icon?: React.ReactNode, disabled?: boolean}&Omit<JSX.IntrinsicElements["button"],"children">) =>
	<button className={twMerge("rounded-full p-2 flex items-center justify-center", interactiveContainerDefault, className)} disabled={disabled} {...props} >
		{icon}
	</button>;

export const LinkButton = ({className, icon, ...props}: React.AnchorHTMLAttributes<HTMLAnchorElement>&{icon?: React.ReactNode}) =>
	<a className={twMerge('flex flex-row gap-2 px-3 py-1.5 items-center rounded-xl text-sm',interactiveContainerDefault,className)} rel="noopener noreferrer" {...props} >
		{icon &&
			<span className="inline-block h-4 w-auto" >{icon}</span> }
		{props.children}
	</a>

export const ThemeSpinner = (props: SpinnerProps) =>
	<Spinner classNames={{
		circle1: "dark:border-b-white border-b-blue-600",
		circle2: "dark:border-b-white border-b-blue-600"
	}} {...props} />;

export const Loading = (props: SpinnerProps) => <div className="h-full w-full flex item-center justify-center py-16 px-20" >
	<ThemeSpinner size="lg" {...props} />
</div>

export const chipColors = {
	red: "dark:bg-red-600 dark:border-red-400 bg-red-400 border-red-200",
	green: "dark:bg-green-600 dark:border-green-400 bg-green-400 border-green-200",
	blue: "dark:border-cyan-400 dark:bg-sky-600 border-cyan-200 bg-sky-400",
	gray: "dark:border-gray-300 dark:bg-gray-600 border-gray-100 bg-gray-300",
	purple: "dark:bg-purple-600 dark:border-purple-300 bg-purple-400 border-purple-300",
	teal: "dark:bg-[#64919b] dark:border-[#67cce0] bg-[#aedbe8] border-[#95e6fc]",
};

export const chipColorKeys = Object.keys(chipColors) as (keyof typeof chipColors)[];

export const Chip = ({className, color, ...props}: HTMLAttributes<HTMLSpanElement>&{color?: keyof typeof chipColors}) =>
	<span className={twMerge("inline-block text-xs px-2 py-1 rounded-lg border-solid border whitespace-nowrap", chipColors[color ?? "gray"], className)}
		{...props} >{props.children}</span>

export const StatusPage = ({children, title}: {children: React.ReactNode, title: string}) =>
	<>
		<div className="flex h-dvh flex-col justify-between items-center py-20 px-5" >
			<AppLink href="/" ><LogoText/></AppLink>
			<div className="flex flex-col lg:w-96" >
				<h1 className="font-display font-extrabold text-4xl mb-4" >{title}</h1>
				<div className="flex flex-col gap-4">
					{children}
				</div>
			</div>

			<Footer/>
		</div>
	</>;

export function ButtonPopover({children, className, title, desc}: {children: React.ReactNode, className?: ClassNameValue, title: string, desc?: string}) {
	return <Popover placement="bottom" showArrow triggerScaleOnOpen={false} >
		<PopoverTrigger>
			<div className="flex-1 md:flex-none" >
				<Button className={twMerge("w-full h-full pr-3 justify-between", className)} >
					<div className="flex flex-col items-start justify-center" >
						<span>{title}</span>
						<Text v="dim" className="whitespace-nowrap" >{desc}</Text>
					</div>
					<IconChevronDown />
				</Button>
			</div>
		</PopoverTrigger>
		<PopoverContent className={`${bgColor.secondary} ${borderColor.default} p-5 pt-3`} >
			{children}
		</PopoverContent>
	</Popover>;
}

export const abbr = (s: string, len: number=300) =>
	s.length > len ? `${s.substring(0, len-3)}...` : s;

const selectStyle: ClassNamesConfig<unknown,boolean> = {
	control: (state) => `flex flex-row gap-4 px-3 py-1.5 dark:bg-zinc-800 bg-zinc-200 items-center border-2 text-zinc-800 dark:text-white rounded-lg hover:cursor-pointer ${state.menuIsOpen ? "dark:border-blue-500 border-blue-400" : "dark:border-zinc-600 border-zinc-300"}`,
	menuList: () => "border-2 border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-100 dark:bg-black mt-1 flex flex-col items-stretch",
	option: ({ isDisabled, isFocused }) => {
		return `${isFocused ? "dark:bg-zinc-800 bg-zinc-300" : ""} hover:bg-zinc-300 dark:hover:bg-zinc-800 p-2 border-t first:border-none dark:border-zinc-700 border-zinc-300 hover:cursor-pointer ${isDisabled ? "dark:text-gray-500 text-gray-400" : ""}`;
	},
	menu: () => "dark:text-white text-zinc-800 absolute w-full",
	multiValue: () => "dark:bg-zinc-700 bg-zinc-300 dark:text-white text-zinc-800 px-2 py-0.5 rounded-md",
	multiValueLabel: () => "dark:text-white text-zinc-800 dark:hover:bg-zinc-700 hover:bg-zinc-300",
	valueContainer: () => "flex flex-row gap-1 overflow-x-auto",
	multiValueRemove: () => "dark:text-white text-zinc-800 dark:hover:bg-zinc-700 hover:bg-zinc-300 dark:hover:text-white hover:text-zinc-800 ml-1",
	indicatorSeparator: () => "mx-1 h-full dark:bg-zinc-600 bg-zinc-300",
	input: () => "dark:text-white text-zinc-800",
	noOptionsMessage: () => "py-2 text-zinc-800 dark:text-white",
	indicatorsContainer: () => "dark:text-white text-zinc-800",
}

const infiniteZIndexHack = (base: object) => ({...base, zIndex: 1000});
export const selectProps = <T,Multi extends boolean>(): SelectProps<T,Multi> => ({
	unstyled: true, classNames: selectStyle as ClassNamesConfig<T,Multi>,
	styles: {
		menuPortal: infiniteZIndexHack, menu: infiniteZIndexHack
	}
});

export const firstLast = (s: string) => {
	const x = s.split(/\s+/);
	return x.length>=2 ? `${x[0]} ${x[x.length-1]}` : x[0];
};

export function shitHash(s: string) {
	const mod = 17;
	let v=3, o=0;
	for (let i=0; i<s.length; i++) {
		o+=s.charCodeAt(i)*v;
		if (o>=mod) o-=mod;
		v=3*v %mod;
	}
	return o;
}

export const CatalogLinkButton = ({href}: {href:string}) =>
	<LinkButton href={href} target="_blank"
		className="dark:bg-[#a88e2f] dark:hover:bg-[#8f7414] bg-[#FFD700] hover:bg-[#FFC300] transition-all duration-300 ease-out"
		icon={<Image src={purdue} alt="Purdue Catalog" className="w-auto h-full invert dark:invert-0" />}>
		Catalog
	</LinkButton>

export const RedditButton = ({keywords}: {keywords:string[]}) =>
	<LinkButton href={`https://www.reddit.com/r/Purdue/search/?q=${
			encodeURIComponent(keywords.join(" OR "))
		}`} target="_blank" rel="noopener noreferrer" className="dark:bg-orange-600 dark:hover:bg-orange-700 bg-orange-400 hover:bg-orange-500 transition-background duration-300 ease-out"
		icon={<Image src={reddit} alt="Reddit" className="w-auto h-full" />}>

		Reddit
	</LinkButton>;

export function capitalize(s: string) {
	const noCap = ["of", "a", "an", "the", "in"];
	return s.split(/\s+/g).filter(x=>x.length>0).map((x,i)=>{
		if (i>0 && noCap.includes(x)) return x;
		else return `${x[0].toUpperCase()}${x.slice(1)}`;
	}).join(" ");
}

type TextVariants = "big"|"lg"|"md"|"dim"|"bold"|"normal"|"err"|"sm"|"smbold";
export function Text({className, children, v, ...props}: HTMLAttributes<HTMLParagraphElement>&{v?: TextVariants}) {
	switch (v) {
		case "big": return <h1 className={twMerge("md:text-3xl text-2xl font-display font-black", textColor.contrast, className)} {...props} >{children}</h1>;
		case "bold": return <b className={twMerge("text-lg font-display font-extrabold", textColor.contrast, className)} {...props} >{children}</b>;
		case "smbold": return <b className={twMerge("text-sm font-display font-bold text-gray-700 dark:text-gray-300", className)} {...props} >{children}</b>;
		case "md": return <h3 className={twMerge("text-xl font-display font-bold", textColor.contrast, className)} {...props} >{children}</h3>;
		case "lg": return <h3 className={twMerge("text-xl font-display font-extrabold", textColor.contrast, className)} {...props} >{children}</h3>;
		case "dim": return <span className={twMerge("text-sm text-gray-500 dark:text-gray-400", className)} {...props} >{children}</span>;
		case "sm": return <p className={twMerge("text-sm text-gray-800 dark:text-gray-200", className)} {...props} >{children}</p>;
		case "err": return <span className={twMerge("text-red-500", className)} {...props} >{children}</span>;
		default: return <p className={className} {...props} >{children}</p>;
	}
}

export const Divider = ({className}: {className?: string}) =>
	<div className={twMerge(`rounded w-px mx-1.5 h-4 self-center flex-shrink-0 ${bgColor.divider}`, className)} />;
	
// export const AppSelect = ({...props}: SelectProps) => <Select {...props}
// 		classNames={{
// 			trigger: twMerge("px-4 py-1.5 bg-zinc-900 border text-white rounded-xl border-zinc-900 hover:border-zinc-700 data-[hover=true]:bg-zinc-900 data-[open=true]:border-blue-500", props.classNames?.trigger)
// 		}}
// 	>
// 	{props.children}
// </Select>
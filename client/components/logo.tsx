import React, { HTMLAttributes, SVGProps } from "react";
import { twMerge } from "tailwind-merge";
import { ButtonRow } from "./settings";

export const Logo = ({className,...props}: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg"
		className={twMerge("dark:fill-white fill-black", className)}
    viewBox="0 0 120 91"
    {...props} >
    <path d="m54.31 90.616-.011.008c-20.431-5.266-38.532-8.268-52.83-7.548l-.611.031V9.458l.477-.088a44.716 44.716 0 0 1 1.877-.3V6.28l.411-.126c.662-.203 1.34-.379 2.033-.53V4.41l.118-.156C7.317 2.219 9.659 1.102 12.583.7c2.809-.387 6.167-.112 9.845.605 10.846 2.114 24.527 8.073 34.977 11.71l.276.096-2.141 70.305c-14.823-5.431-30.197-10.167-40.026-10.617-4.149-.19-7.277.345-8.847 2.048l-1.011-.395V6.817c-.433.099-.859.208-1.279.328V78.43c12.674-2.779 25.331-.354 38.582 4.196l3.553 2.501c-14.72-5.446-28.63-8.677-42.585-5.401l-.715-.567V10.246c-.398.057-.795.119-1.19.186v71.452c13.604-.581 30.562 2.105 49.644 6.87l2.644 1.862Zm8.009-77.505.276-.096c10.45-3.637 24.131-9.596 34.977-11.71 3.678-.717 7.036-.992 9.845-.605 2.924.402 5.266 1.519 6.809 3.554l.118.156v1.214c.693.151 1.371.327 2.033.53l.411.126v2.79c.63.087 1.255.187 1.877.3l.477.088v73.649l-.611-.031c-14.298-.72-32.399 2.282-52.83 7.548l-.011-.008 2.644-1.862c19.082-4.765 36.04-7.451 49.644-6.87V10.432a46.753 46.753 0 0 0-1.19-.186v68.913l-.715.567c-13.955-3.276-27.865-.045-42.585 5.401l3.553-2.501c13.251-4.55 25.908-6.975 38.582-4.196V7.145c-.42-.12-.846-.229-1.279-.328v67.635l-1.011.395c-1.57-1.703-4.698-2.238-8.847-2.048-9.829.45-25.203 5.186-40.026 10.617l-2.141-70.305Z" />
  </svg>
);

export const LogoText = ({className, ...props}: HTMLAttributes<HTMLHRElement>) => 
	<h1 className={twMerge("text-4xl md:text-6xl mr-2 my-auto select-none cursor-pointer font-display font-black", className)} {...props} >BoilerCourses</h1>;

export const LogoBar = React.forwardRef<HTMLDivElement, JSX.IntrinsicElements["div"]>(
  function LogoBar({onClick, className, ...props}: JSX.IntrinsicElements["div"], ref) {
    return <div ref={ref} className={twMerge('flex flex-row mb-2 md:mb-4 lg:mb-8 cursor-pointer justify-between', className)} {...props} >
      <div className="flex flex-row" onClick={onClick} >
        <Logo className='my-auto w-10 h-10 ml-2 mr-2 lg:ml-0 md:w-16 md:h-16' />
        <LogoText className="text-2xl md:text-5xl" />
      </div>
      <ButtonRow/>
    </div>;
  }
);
import { useLocation, useNavigationType } from "react-router-dom";
import { AnimatePresence, motion, Variants } from "framer-motion"; // Import Variants type

export default function PageTransition({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const navType = useNavigationType();
    const goingBack = navType === "POP";

    // Define variants with proper TypeScript typing and easing functions
    const variants: Variants = {
        initial: (back: boolean) => ({ 
            x: back ? -20 : 20, 
            opacity: 0 
        }),
        animate: { 
            x: 0, 
            opacity: 1, 
            transition: { 
                duration: 0.22, 
                ease: [0.25, 0.1, 0.25, 1] // Using cubic-bezier for easeOut
            } 
        },
        exit: (back: boolean) => ({ 
            x: back ? 20 : -20, 
            opacity: 0, 
            transition: { 
                duration: 0.18, 
                ease: [0.42, 0, 1, 1] // Using cubic-bezier for easeIn
            } 
        })
    };

    return (
        <AnimatePresence initial={false} custom={goingBack} mode="popLayout">
            <motion.div
                key={location.pathname}
                custom={goingBack}
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    )
}
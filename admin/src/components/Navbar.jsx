import React, { useRef, useState } from 'react'
import {navbarStyles as ns} from '../assets/dummyStyles';
import logoImg from "../assets/logo.png";
import {Link, NavLink} from "react-router-dom";
import { Calendar, Grid, Home, List, Menu, PlusSquare, UserPlus, Users, X } from 'lucide';
import Icon from './Icon';

const navItems = [
    { to: "/", label: "Dashboard", icon: Home },
    { to: "/add", label: "Add Doctor", icon: UserPlus },
    { to: "/list", label: "List Doctors", icon: Users },
    { to: "/appointments", label: "Appointments", icon: Calendar },
    { to: "/service-dashboard", label: "Service Dashboard", icon: Grid },
    { to: "/add-service", label: "Add Service", icon: PlusSquare },
    { to: "/list-service", label: "List Services", icon: List },
    { to: "/service-appointments", label: "Service Appointments", icon: Calendar },
];

const Navbar = () => {
    const [open, setOpen] = useState(false);
    const navInnerRef= useRef(null);

  return (
    <header className={ns.header}>
        <nav className={ns.navContainer}>
            <div className={ns.flexContainer}>
                <Link to="/" className={ns.logoContainer} onClick={() => setOpen(false)}>
                    <img src={logoImg} alt='logo' className={ns.logoImage}/>
                    <div>
                        <div className={ns.logoLink}>Medicare</div>
                        <div className={ns.logoSubtext}>Admin Console</div>
                    </div>
                </Link>
                {/*centernavigations*/}
                <div className={ns.centerNavContainer}>
                    <div className={ns.glowEffect}>
                        <div className={ns.centerNavInner}>
                            <div ref={navInnerRef} tabIndex={0} className={ns.centerNavScrollContainer} style={{
                                WebkitOverflowScrolling:"touch"
                            }}>
                                {navItems.map((item) => (
                                    <CenterNavItem
                                        key={item.to}
                                        to={item.to}
                                        label={item.label}
                                        icon={item.icon}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    aria-label={open ? "Close menu" : "Open menu"}
                    aria-expanded={open}
                    onClick={() => setOpen((value) => !value)}
                    className={ns.mobileMenuButton}
                >
                    <Icon icon={open ? X : Menu} size={22} />
                </button>
            </div>
            {open && (
                <>
                    <button
                        type="button"
                        aria-label="Close navigation overlay"
                        className={ns.mobileOverlay}
                        onClick={() => setOpen(false)}
                    />
                    <div className={ns.mobileMenuContainer}>
                        <div className={ns.mobileMenuInner}>
                            {navItems.map((item) => (
                                <MobileNavItem
                                    key={item.to}
                                    to={item.to}
                                    label={item.label}
                                    icon={item.icon}
                                    onClick={() => setOpen(false)}
                                />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </nav>

    </header>
  )
}

export default Navbar;

function CenterNavItem({to, icon, label}){
    return (
        <NavLink
            to={to}
            end
            className={({isActive}) => `nav-item ${isActive ? "active" : ""} ${ns.centerNavItemBase} ${isActive ? ns.centerNavItemActive : ns.centerNavItemInactive}`}>
                <Icon icon={icon} />
                <span className="font-medium">{label}</span>
            </NavLink>
    )
}

function MobileNavItem({to, icon, label, onClick}){
    return (
        <NavLink
            to={to}
            end
            onClick={onClick}
            className={({isActive}) => `${ns.mobileItemBase} ${isActive ? ns.mobileItemActive : ns.mobileItemInactive}`}>
                <Icon icon={icon} size={18} />
                <span className="font-medium">{label}</span>
            </NavLink>
    )
}

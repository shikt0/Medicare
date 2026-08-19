import React, { useState, useRef, useEffect } from 'react';
import {navbarStyles} from '../assets/dummyStyles'
import { useLocation, Link } from 'react-router-dom';
import { useClerk, useAuth, UserButton } from '@clerk/react';
import { User, Key, Menu, X } from 'lucide-react';
import logo from '../assets/logo.png'


const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
const { isSignedIn } = useAuth();
  const location = useLocation();
  const navRef = useRef(null);
  const clerk = useClerk();

  //hide and show navbar on scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShowNavbar(false);
      } else {
        setShowNavbar(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);


  //close the toggle menu for mobile while clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && navRef.current && !navRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const navItems = [
    { label: "Home", href: "/" },
    { label: "Doctors", href: "/doctors" },
    { label: "Services", href: "/services" },
    { label: "Appointments", href: "/appointments" },
    { label: "Contact", href: "/contact" },
  ];
  return (
    <>
      <div className={navbarStyles.navbarBorder}></div>


      <nav ref={navRef} className={`${navbarStyles.navbarContainer} ${
        showNavbar? navbarStyles.navbarVisible: navbarStyles.navbarHidden
      }`}>
          <div className={navbarStyles.contentWrapper}>
            <div className={navbarStyles.flexContainer}>
              {/* Logo */}
              <Link to='/' className={navbarStyles.logoLink}>
              <div className={navbarStyles.logoContainer}></div>
              <div className={navbarStyles.logoImageWrapper}>
                <img src={logo} alt="logo" className={navbarStyles.logoImage} />
              </div>
              <div className={navbarStyles.logoTextContainer}>
                <h1 className={navbarStyles.logoTitle}>MediCare</h1>
                <p className={navbarStyles.logoSubtitle}>Health Solutions</p>
              </div>
              </Link>
              <div className={navbarStyles.desktopNav}>
                <div className={navbarStyles.navItemsContainer}>
                  {navItems.map((item)=>{
                    const isActive=location.pathname === item.href;
                    return(
                      <Link key={item.href} to={item.href} className={`${navbarStyles.navItem} ${
                        isActive? navbarStyles.navItemActive :navbarStyles.navItemInactive
                      }`}>
                        {item.label}
                      </Link>
                    )                  })}
                </div>
              </div>

              {/* right side*/}
              
                  <div className={navbarStyles.rightContainer}>
                    {!isSignedIn && (
                          <>
                            <Link
                                to="/doctor-admin/login"
                                className={navbarStyles.doctorAdminButton}
                                                       >
                                  <User className={navbarStyles.doctorAdminIcon} />
                                    <span className={navbarStyles.doctorAdminText}>
                                            Doctor Admin
                                      </span>
                                      </Link>

                                         <button
                                       onClick={() => clerk.openSignIn()}
                                       className={navbarStyles.loginButton}
                                          >
                                       <Key className={navbarStyles.loginIcon} />
                                            <span>Login</span>
                                    </button>
                                     </>
                                                        )}
                 {isSignedIn && <UserButton afterSignOutUrl="/" />}


                 {/* to toggle */}
                 <button onClick={()=>setIsOpen(!isOpen)} className={navbarStyles.mobileToggle}>
                  {isOpen? (
                    <X className={navbarStyles.toggleIcon}/>)
                    :(
                      <Menu className={navbarStyles.toggleIcon}/>
                    )
                  
                  
                }

                 </button>
                    
                  </div>

            </div>

            {/* mobile navigation menu */}
            {isOpen&&(
              <div className={navbarStyles.mobileMenu}>
              {navItems.map((item,idx)=>{
                const isActive =location.pathname=== item.href;
                return (
                  <Link key={idx} to={item.href} onClick={()=>setIsOpen(false)} className={`${navbarStyles.mobileMenuItem} ${isActive ? navbarStyles.mobileMenuItemActive : navbarStyles.mobileMenuItemInactive}`}>
                  {item.label}
                  </Link>
                )
              })}
              {!isSignedIn && (
    <>
        <Link
            to="/doctor-admin/login"
            className={navbarStyles.mobileDoctorAdminButton}
            onClick={() => setIsOpen(false)}
        >
            Doctor Admin
        </Link>

        <div className={navbarStyles.mobileLoginContainer}>
            <button
                onClick={() => {
                    setIsOpen(false);
                    clerk.openSignIn();
                }}
                className={navbarStyles.mobileLoginButton}
            >
                Login
            </button>
        </div>
    </>
)}

              </div>

            )
            }
          </div>

          <style>
            {navbarStyles.animationStyles}
          </style>

      </nav>
    </>
  )
}

export default Navbar

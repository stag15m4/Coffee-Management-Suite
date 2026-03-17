'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Coffee, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SITE_NAME, APP_URL, NAV_LINKS } from '@/lib/constants';
import MobileMenu from './MobileMenu';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 50);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-[var(--z-sticky)]',
          'transition-all duration-300 ease-in-out',
          scrolled ? 'bg-espresso-950/85 shadow-lg backdrop-blur-[12px]' : 'bg-transparent'
        )}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-[72px] lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Coffee className="h-6 w-6 text-caramel-400" strokeWidth={2} />
            <span className="hidden font-clash text-lg font-medium text-cream-50 lg:inline">{SITE_NAME}</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group relative font-general text-[15px] font-medium text-cream-50 transition-colors duration-200 hover:text-caramel-400"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 h-0.5 w-full origin-center scale-x-0 bg-caramel-400 transition-transform duration-200 group-hover:scale-x-100" />
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-4 lg:flex">
            <a
              href={APP_URL}
              className="font-general text-[15px] font-medium text-cream-50 transition-colors duration-200 hover:text-caramel-400"
            >
              Sign In
            </a>
            <a
              href={`${APP_URL}/register`}
              className={cn(
                'rounded-full bg-caramel-400 px-6 py-2.5',
                'font-general font-semibold text-espresso-950',
                'transition-all duration-200',
                'hover:scale-[1.02] hover:bg-caramel-500'
              )}
            >
              Get Started
            </a>
          </div>

          {/* Mobile Hamburger */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-cream-50 transition-colors hover:text-caramel-400 lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </nav>
      </header>

      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, CalendarIcon, AlertCircle, Users, Loader2, Phone } from "lucide-react"
import { format, differenceInYears } from "date-fns"
import { AuthLayout } from "@/components/customer/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { cn } from "@/lib/utils"

// Social provider icons as SVG components
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function SignUpPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined)
  const [ageError, setAgeError] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)
  
  // Phone auth states
  const [showPhoneDialog, setShowPhoneDialog] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState("")
  const [phoneLoading, setPhoneLoading] = useState(false)

  // Handle social sign up
  function handleSocialSignUp(provider: string) {
    setSocialLoading(provider)
    // Simulate social auth - in production, this would redirect to OAuth flow
    setTimeout(() => {
      router.push("/customer/dashboard")
    }, 1000)
  }

  // Handle phone sign up
  function handleSendOtp() {
    if (!phoneNumber || phoneNumber.length < 10) return
    setPhoneLoading(true)
    // Simulate sending OTP
    setTimeout(() => {
      setOtpSent(true)
      setPhoneLoading(false)
    }, 1000)
  }

  function handleVerifyOtp() {
    if (otp.length !== 6) return
    setPhoneLoading(true)
    // Simulate OTP verification
    setTimeout(() => {
      router.push("/customer/dashboard")
    }, 1000)
  }

  // Calculate age from date of birth
  const calculateAge = (dob: Date) => {
    return differenceInYears(new Date(), dob)
  }

  // Check if user is 18 or older
  const isAdult = dateOfBirth ? calculateAge(dateOfBirth) >= 18 : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validate age requirement
    if (!dateOfBirth) {
      setAgeError(true)
      return
    }
    
    if (!isAdult) {
      setAgeError(true)
      return
    }
    
    setAgeError(false)
    setIsLoading(true)
    // Simulate sign up
    setTimeout(() => {
      router.push("/customer/dashboard")
    }, 800)
  }

  return (
    <AuthLayout
      heading="Create your account"
      subheading="Join your community and stay connected."
    >
      {/* Social Auth Buttons */}
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          className="w-full h-11"
          onClick={() => handleSocialSignUp("google")}
          disabled={socialLoading !== null || isLoading}
        >
          {socialLoading === "google" ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <GoogleIcon className="mr-2 h-5 w-5" />
          )}
          Continue with Google
        </Button>
        
        <Button
          type="button"
          variant="outline"
          className="w-full h-11"
          onClick={() => setShowPhoneDialog(true)}
          disabled={socialLoading !== null || isLoading}
        >
          <Phone className="mr-2 h-5 w-5" />
          Continue with Phone
        </Button>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            placeholder="John Doe"
            required
            autoComplete="name"
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="dob">Date of Birth <span className="text-destructive">*</span></Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="dob"
                variant="outline"
                className={cn(
                  "w-full h-11 justify-start text-left font-normal",
                  !dateOfBirth && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateOfBirth ? format(dateOfBirth, "MMMM d, yyyy") : "Select your date of birth"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateOfBirth}
                onSelect={(date) => {
                  setDateOfBirth(date)
                  setAgeError(false)
                }}
                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                initialFocus
                captionLayout="dropdown-buttons"
                fromYear={1920}
                toYear={new Date().getFullYear()}
              />
            </PopoverContent>
          </Popover>
          
          {/* Age verification message */}
          {dateOfBirth && isAdult === false && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You must be 18 years or older to create an account. If you are under 18, please ask a parent or guardian to create an account and add you as a family member in their profile.
              </AlertDescription>
            </Alert>
          )}
          
          {dateOfBirth && isAdult === true && (
            <p className="text-xs text-green-600">
              Age verified: {calculateAge(dateOfBirth)} years old
            </p>
          )}
          
          {ageError && !dateOfBirth && (
            <p className="text-xs text-destructive">
              Please select your date of birth
            </p>
          )}
        </div>

        {/* Info about family members */}
        <Alert className="border-muted bg-muted/50">
          <Users className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Only adults (18+) can create accounts. Children and minors can be added as family members within your profile after registration.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              required
              autoComplete="new-password"
              className="pr-10 h-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
              className="pr-10 h-11"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full h-11" 
          disabled={isLoading || (dateOfBirth && !isAdult)}
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>

      {/* Phone Auth Dialog */}
      <Dialog open={showPhoneDialog} onOpenChange={(open) => {
        setShowPhoneDialog(open)
        if (!open) {
          setPhoneNumber("")
          setOtpSent(false)
          setOtp("")
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{otpSent ? "Enter verification code" : "Sign up with phone"}</DialogTitle>
            <DialogDescription>
              {otpSent 
                ? `We sent a 6-digit code to ${phoneNumber}` 
                : "Enter your phone number and we'll send you a verification code."
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4">
            {!otpSent ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="h-11"
                  />
                </div>
                <Button 
                  onClick={handleSendOtp} 
                  disabled={phoneLoading || phoneNumber.length < 10}
                  className="w-full h-11"
                >
                  {phoneLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send verification code"
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-4">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={setOtp}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  
                  <button 
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => {
                      setOtpSent(false)
                      setOtp("")
                    }}
                  >
                    Change phone number
                  </button>
                </div>
                
                <Button 
                  onClick={handleVerifyOtp} 
                  disabled={phoneLoading || otp.length !== 6}
                  className="w-full h-11"
                >
                  {phoneLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify and create account"
                  )}
                </Button>
                
                <p className="text-center text-xs text-muted-foreground">
                  Didn't receive the code?{" "}
                  <button 
                    type="button" 
                    className="text-primary hover:underline"
                    onClick={handleSendOtp}
                  >
                    Resend
                  </button>
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AuthLayout>
  )
}

import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Get the auth token from the service
    const currentUser = this.authService.currentUserValue;
    
    // Clone the request and add auth header if user is logged in
    if (currentUser && currentUser.token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${currentUser.token}`
        }
      });
    }

    // Pass the cloned request to the next handler
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle 401 Unauthorized or 404 Not Found errors
        if (error.status === 401 || (error.status === 404 && error.url?.includes('Login'))) {
          console.log('Authentication error, redirecting to mock data');
          // Instead of redirecting, we'll just log and let the service handle it with mock data
        }
        
        return throwError(() => error);
      })
    );
  }
} 
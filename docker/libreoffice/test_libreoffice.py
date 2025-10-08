import uno
import sys
import os
from time import sleep

def test_libreoffice_connection():
    try:
        # Get the uno component context from the PyUNO runtime
        localContext = uno.getComponentContext()
        
        # Create the UnoUrlResolver
        resolver = localContext.ServiceManager.createInstanceWithContext(
            "com.sun.star.bridge.UnoUrlResolver", localContext)
        
        # Connect to the running office
        ctx = resolver.resolve("uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext")
        smgr = ctx.ServiceManager
        
        # Get the desktop service
        desktop = smgr.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        
        if desktop:
            print("✓ Successfully connected to LibreOffice!")
            print("✓ LibreOffice service is running and accepting connections")
            print("✓ UNO bridge is working properly")
            return True
            
    except Exception as e:
        print("✗ Failed to connect to LibreOffice")
        print(f"Error: {str(e)}")
        return False

if __name__ == "__main__":
    print("Testing LibreOffice connection...")
    print("-" * 50)
    success = test_libreoffice_connection()
    print("-" * 50)
    sys.exit(0 if success else 1)
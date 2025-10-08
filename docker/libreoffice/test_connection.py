import uno

# Try to connect to running LibreOffice instance
try:
    localContext = uno.getComponentContext()
    resolver = localContext.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver", localContext)
    context = resolver.resolve(
        "uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext")
    print("Successfully connected to LibreOffice!")
except Exception as e:
    print(f"Failed to connect: {str(e)}")
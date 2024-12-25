import logging
logging.basicConfig(filename="intercepted_data.log", level=logging.INFO)

def response(flow: http.HTTPFlow):
    if "aviator-next.spribegaming.com" in flow.request.host:
        logging.info(flow.response.text)

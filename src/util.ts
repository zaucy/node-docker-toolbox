class DockerToolboxOptionsParseError extends Error {};

export interface IOptionsToArgsParseOptions {
  prefix?: string;
}

export function optionsToArgs
  ( options: {[key:string]: any}
  , parseOptions?: IOptionsToArgsParseOptions
  )
{
  parseOptions = parseOptions || {};

  const prefix = parseOptions.prefix || '';

  let optArgs: string[] = [];

  for(let key in options) {
    let optionValue = options[key];
    
    key = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const optKey = '--' + prefix + key;

    if(typeof optionValue === 'boolean') {
      if(optionValue) {
        optArgs.push(optKey);
      }
    } else
    if(typeof optionValue === 'string') {
      optArgs.push(optKey);
      if(optionValue.search(/\s+/) > -1) {
        optArgs.push(`"${optionValue}"`);
      } else {
        optArgs.push(optionValue);
      }
    } else
    if(typeof optionValue === 'number') {
      optArgs.push(optKey);
      optArgs.push(optionValue.toString());
    } else
    if(Array.isArray(optionValue)) {
      optArgs.push(optKey);
      optArgs.push(optionValue.join(','));
    } else if(optionValue) {
      for(const key in optionValue) {
        const value = optionValue[key];

        if(key.search(/\s+/) > -1) {
          throw new DockerToolboxOptionsParseError("Options object argument key may not contain whitespace characters");
        }

        if(typeof value === "string") {
          if(value.search(/\s+/) > -1) {
            throw new DockerToolboxOptionsParseError("Options object argument value may not contain whitespace characters");
          }
        } else
        if(Array.isArray(value)) {
          value.forEach(v => {
            if(typeof v === "string") {
              if(v.search(/\s+/) > -1) {
                throw new DockerToolboxOptionsParseError("Options object argument value array element may not contain whitespace characters");
              }
            } else if(typeof v === "object") {
              throw new DockerToolboxOptionsParseError("Options object argument value array element may only be a string or a number");
            }
          });
        } else
        if(value && typeof value === "object") {
          throw new DockerToolboxOptionsParseError("Options object argument value may only be a string, number, boolean or an array containing strings, numbers and booleans. " + value + "was received instead.");
        }

        optArgs.push(optKey);
        optArgs.push(`${key}=${value}`);
      }
    }
  }

  return optArgs;
}
